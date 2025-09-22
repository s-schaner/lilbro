"""In-memory ingest job coordination for mocked pipeline responses."""
from __future__ import annotations

from itertools import cycle
from typing import Dict, Iterable, List


class IngestJobStore:
    """Store ingest jobs and provide finite state transitions."""

    def __init__(self) -> None:
        self._jobs: Dict[str, Dict[str, object]] = {}
        self._state_sequence: List[str] = [
            "queued",
            "analyzing",
            "mezzanine",
            "trainer-ready",
            "completed",
        ]

    @property
    def sequence(self) -> Iterable[str]:
        return tuple(self._state_sequence)

    def create_job(self, source: str) -> Dict[str, object]:
        job_id = f"job-{len(self._jobs) + 1}"
        state_cycle = cycle(self._state_sequence)
        current_state = next(state_cycle)
        self._jobs[job_id] = {
            "cycle": state_cycle,
            "state": current_state,
            "source": source,
        }
        return {"job_id": job_id, "state": current_state}

    def advance_job(self, job_id: str) -> Dict[str, object]:
        if job_id not in self._jobs:
            raise KeyError(job_id)
        job = self._jobs[job_id]
        job["state"] = next(job["cycle"])
        return {"job_id": job_id, "state": job["state"]}

    def peek_job(self, job_id: str) -> Dict[str, object]:
        if job_id not in self._jobs:
            raise KeyError(job_id)
        job = self._jobs[job_id]
        return {"job_id": job_id, "state": job["state"]}

    def list_jobs(self) -> List[Dict[str, object]]:
        return [self.peek_job(job_id) for job_id in self._jobs]


job_store = IngestJobStore()
