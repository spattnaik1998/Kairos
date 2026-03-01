"""Temporal Pattern Library endpoints."""

from fastapi import APIRouter, HTTPException
from ....schemas.models import PatternAnalogueRequest, PatternAnalogueResponse
from ....services.patterns import get_pattern_service

router = APIRouter(prefix="/patterns", tags=["Temporal Pattern Library"])


@router.post("/analogues", response_model=PatternAnalogueResponse)
async def find_analogues(req: PatternAnalogueRequest):
    """
    Identify historical market periods that most closely resemble
    the current environment using temporal fingerprinting.

    Leverages TimesFM's 16k context capability to analyse long-range
    temporal patterns via cosine similarity across normalised market series.

    Returns top-N historical analogues with similarity scores and
    post-analogue outcomes (what happened to SPX, bonds, and VIX
    in the 90 days following each historical match).
    """
    try:
        svc = get_pattern_service()
        result = svc.find_analogues(
            lookback_days=req.lookback_days,
            n_analogues=req.n_analogues,
            fingerprint_series=req.fingerprint_series,
        )
        return PatternAnalogueResponse(**result)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
