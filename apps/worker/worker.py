import os
import signal
import time

from app.database import SessionLocal
from app.ingestion import process_next_job


running = True


def handle_shutdown(signum: int, frame: object) -> None:
    global running
    running = False


signal.signal(signal.SIGTERM, handle_shutdown)
signal.signal(signal.SIGINT, handle_shutdown)


def main() -> None:
    upload_dir = os.getenv("UPLOAD_DIR", "/data/uploads")
    poll_seconds = float(os.getenv("WORKER_POLL_SECONDS", "5"))
    run_once = os.getenv("WORKER_RUN_ONCE", "false").lower() in {"1", "true", "yes"}
    print(f"Worker ready; upload_dir={upload_dir}; mode=full-drain", flush=True)

    while running:
        with SessionLocal() as db:
            job = process_next_job(db)
        if job is not None:
            print(f"Processed ingestion job {job.id}; status={job.status}", flush=True)
        if run_once:
            break
        time.sleep(poll_seconds)


if __name__ == "__main__":
    main()
