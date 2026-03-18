"""
MemoriaKids 顔認識エンジン
InsightFaceを使用して園児の顔を検出・識別する
"""

from __future__ import annotations

import logging
from typing import Any

import cv2
import numpy as np

logger = logging.getLogger(__name__)


class FaceRecognitionEngine:
    """
    顔認識エンジン

    InsightFaceのArcFaceモデルを使用して顔の検出・特徴抽出・照合を行う。
    GPUが利用可能な場合は自動的にGPUを使用する。
    """

    def __init__(self, det_thresh: float = 0.5, det_size: tuple[int, int] = (640, 640)):
        """
        Args:
            det_thresh: 顔検出の信頼度閾値
            det_size: 顔検出モデルの入力サイズ
        """
        self._model = None
        self._det_thresh = det_thresh
        self._det_size = det_size
        self._is_loaded = False

    @property
    def is_loaded(self) -> bool:
        """モデルが読み込み済みかどうか"""
        return self._is_loaded

    async def initialize(self) -> None:
        """
        顔認識モデルの初期化

        InsightFaceのbuffalo_lモデルをダウンロード・ロードする。
        GPU (CUDAExecutionProvider) が利用可能であれば自動的に使用する。
        """
        try:
            import insightface
            from insightface.app import FaceAnalysis

            # プロバイダの選択（GPU優先）
            providers = self._get_execution_providers()
            logger.info(f"使用するプロバイダ: {providers}")

            # モデルの初期化
            self._model = FaceAnalysis(
                name="buffalo_l",
                root="~/.insightface",
                providers=providers,
            )
            self._model.prepare(
                ctx_id=0,
                det_thresh=self._det_thresh,
                det_size=self._det_size,
            )

            self._is_loaded = True
            logger.info("顔認識モデルの初期化が完了しました")

        except Exception as e:
            logger.error(f"顔認識モデルの初期化に失敗: {e}")
            # フォールバック: モデルなしで起動（ヘルスチェックでステータスを報告）
            self._is_loaded = False

    def _get_execution_providers(self) -> list[str]:
        """
        利用可能なONNXRuntime実行プロバイダを検出する
        CUDA > TensorRT > CPU の優先順位
        """
        try:
            import onnxruntime as ort
            available = ort.get_available_providers()
            logger.info(f"利用可能なONNXRuntimeプロバイダ: {available}")

            # 優先順位に基づいてプロバイダを選択
            preferred_order = [
                "TensorrtExecutionProvider",
                "CUDAExecutionProvider",
                "CPUExecutionProvider",
            ]
            selected = [p for p in preferred_order if p in available]
            return selected if selected else ["CPUExecutionProvider"]

        except ImportError:
            logger.warning("onnxruntimeが見つかりません。CPUモードで動作します")
            return ["CPUExecutionProvider"]

    def detect_and_extract(self, image: np.ndarray) -> list[dict[str, Any]]:
        """
        画像から顔を検出し、特徴ベクトルを抽出する

        Args:
            image: RGB形式のnumpy配列 (H, W, 3)

        Returns:
            検出された顔のリスト。各要素は以下のキーを持つ辞書:
            - bbox: バウンディングボックス [x1, y1, x2, y2]
            - embedding: 512次元の特徴ベクトル
            - quality_score: 顔画像の品質スコア (0.0-1.0)
            - landmarks: 顔のランドマーク座標
        """
        if not self._is_loaded or self._model is None:
            logger.error("モデルが初期化されていません")
            return []

        # InsightFaceはBGR形式を期待する
        bgr_image = cv2.cvtColor(image, cv2.COLOR_RGB2BGR)

        try:
            faces = self._model.get(bgr_image)
        except Exception as e:
            logger.error(f"顔検出に失敗: {e}")
            return []

        detections: list[dict[str, Any]] = []
        for face in faces:
            # 特徴ベクトルが抽出できない場合はスキップ
            if face.embedding is None:
                continue

            # 顔品質スコアの算出
            quality_score = self._compute_quality_score(face, image.shape)

            detection = {
                "bbox": face.bbox.tolist(),
                "embedding": face.normed_embedding,
                "quality_score": quality_score,
                "landmarks": face.landmark_2d_106.tolist() if face.landmark_2d_106 is not None else [],
                "det_score": float(face.det_score),
            }
            detections.append(detection)

        logger.info(f"{len(detections)}個の顔を検出しました")
        return detections

    def _compute_quality_score(self, face: Any, image_shape: tuple) -> float:
        """
        顔画像の品質スコアを算出する

        以下の要素を総合的に評価:
        - 検出信頼度
        - 顔のサイズ（画像に対する相対サイズ）
        - 顔の正面度（ランドマークの対称性）

        Returns:
            0.0 (低品質) ~ 1.0 (高品質)
        """
        scores: list[float] = []

        # 1. 検出信頼度スコア
        det_score = float(face.det_score) if face.det_score is not None else 0.5
        scores.append(min(det_score, 1.0))

        # 2. 顔サイズスコア（小さすぎる顔はペナルティ）
        bbox = face.bbox
        face_width = bbox[2] - bbox[0]
        face_height = bbox[3] - bbox[1]
        img_height, img_width = image_shape[:2]

        face_area_ratio = (face_width * face_height) / (img_width * img_height)
        # 顔が画像の5%以上を占めていれば良好
        size_score = min(face_area_ratio / 0.05, 1.0)
        scores.append(size_score)

        # 3. 正面度スコア（ランドマークベース）
        if face.landmark_2d_106 is not None:
            landmarks = face.landmark_2d_106
            # 左右の目の中心の高さの差で正面度を推定
            left_eye = landmarks[33]   # 左目の中心付近
            right_eye = landmarks[87]  # 右目の中心付近
            eye_height_diff = abs(left_eye[1] - right_eye[1])
            eye_dist = np.linalg.norm(left_eye - right_eye)
            if eye_dist > 0:
                frontal_score = max(0.0, 1.0 - (eye_height_diff / eye_dist) * 3.0)
                scores.append(frontal_score)

        return float(np.mean(scores))

    def find_best_match(
        self,
        query_embedding: np.ndarray,
        stored_vectors: list[dict[str, Any]],
        threshold: float = 0.6,
    ) -> dict[str, Any] | None:
        """
        クエリ顔ベクトルと登録済みベクトル群を比較し、最も類似する園児を返す

        Args:
            query_embedding: クエリ顔の512次元特徴ベクトル
            stored_vectors: 登録済みベクトルのリスト
                各要素は {"child_id": str, "embedding": np.ndarray}
            threshold: 一致判定の閾値（コサイン類似度）

        Returns:
            最も類似する園児の情報、または閾値未満ならNone
        """
        if len(stored_vectors) == 0:
            return None

        best_match: dict[str, Any] | None = None
        best_similarity = -1.0

        # クエリベクトルの正規化
        query_norm = query_embedding / (np.linalg.norm(query_embedding) + 1e-10)

        for entry in stored_vectors:
            stored_embedding = entry["embedding"]
            stored_norm = stored_embedding / (np.linalg.norm(stored_embedding) + 1e-10)

            # コサイン類似度の計算
            similarity = float(np.dot(query_norm, stored_norm))

            if similarity > best_similarity and similarity >= threshold:
                best_similarity = similarity
                best_match = {
                    "child_id": entry["child_id"],
                    "confidence": similarity,
                }

        return best_match

    def batch_compare(
        self,
        query_embeddings: np.ndarray,
        stored_embeddings: np.ndarray,
    ) -> np.ndarray:
        """
        複数の顔ベクトル同士をバッチで比較する（高速版）

        Args:
            query_embeddings: (N, 512) クエリ顔ベクトルの行列
            stored_embeddings: (M, 512) 登録済み顔ベクトルの行列

        Returns:
            (N, M) コサイン類似度行列
        """
        # 正規化
        query_norms = query_embeddings / (
            np.linalg.norm(query_embeddings, axis=1, keepdims=True) + 1e-10
        )
        stored_norms = stored_embeddings / (
            np.linalg.norm(stored_embeddings, axis=1, keepdims=True) + 1e-10
        )

        # 行列積でコサイン類似度を一括計算
        similarity_matrix = np.dot(query_norms, stored_norms.T)
        return similarity_matrix
