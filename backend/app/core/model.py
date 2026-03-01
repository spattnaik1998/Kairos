"""TimesFM model singleton — loaded once at startup, shared across requests."""

import logging
import torch
import timesfm
from functools import lru_cache
from .config import get_settings

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_timesfm_model() -> timesfm.TimesFM_2p5_200M_torch:
    """Load and compile the TimesFM 2.5 model (cached singleton)."""
    settings = get_settings()

    logger.info("Loading TimesFM 2.5 (200M) from HuggingFace…")
    torch.set_float32_matmul_precision("high")

    model = timesfm.TimesFM_2p5_200M_torch.from_pretrained(
        settings.timesfm_repo,
        token=settings.hf_token or None,
    )

    model.compile(
        timesfm.ForecastConfig(
            max_context=settings.timesfm_max_context,
            max_horizon=settings.timesfm_max_horizon,
            normalize_inputs=True,
            use_continuous_quantile_head=True,
            force_flip_invariance=True,
            infer_is_positive=False,  # assets can be negative (returns)
            fix_quantile_crossing=True,
            return_backcast=True,     # needed for XReg covariate mode
        )
    )

    logger.info("TimesFM ready.")
    return model
