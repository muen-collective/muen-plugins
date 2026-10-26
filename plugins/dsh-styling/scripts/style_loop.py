#!/usr/local/bin/python3
"""
Style the queued looks with the RunningHub Qwen AIO app.

THE QUEUE IS THE PLP'S TOP BUTTON. `/plugins/styling/regenerate` writes
`<profile>/styling/job.json` with the looks that are not approved; this script
reads that file, styles only those looks, and never touches the approved ones.

DRY RUN BY DEFAULT. `--run` is the only way to spend a coin. A dry run prints the
exact queue, the model reference, the output path, and the estimate, and makes no
network call at all.

One look: Image 1 = the look's cover original; Image 2 = a model reference from
`assets/models/`; the prompt preserves the outfit and swaps the subject, the
background and the light. The output is saved as
`look NNN-final/look-NNN.<ext>`; an older final of the same name is archived as
`look-NNN_r<timestamp>.<ext>` first.

Run it with the interpreter that has `requests`:

    /usr/local/bin/python3 plugins/dsh-styling/scripts/style_loop.py
    /usr/local/bin/python3 plugins/dsh-styling/scripts/style_loop.py --run --limit 1
"""
import argparse
import json
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path

import requests

APP_ID = "2090168183268347906"  # Qwen Edit AIO · Product Fit
NODE_IMAGE_1 = "232"           # the outfit / look photograph
NODE_IMAGE_2 = "235"           # the model reference
NODE_PROMPT = "248"            # the instruction
EST_COST = 0.012               # USD per run, the gate's own measured range

SWAP_PROMPT = (
    "Swap the subject, face, hairstyle and body in the original image 1 with the "
    "subject, face, hairstyle and body from image 2.\n\n"
    "Remove any phone or object held in the subject's hand. The hands must be empty "
    "and relaxed at the sides.\n\n"
    "Remove any glasses or eyewear from the subject.\n\n"
    "Swap the shoes to match the shoes in image 2.\n\n"
    "CRITICAL INSTRUCTION: Keep the outfit exactly the same with 100% fidelity. "
    "Do not alter the outfit. Preserve all original colors, textures, and structural "
    "details of the clothing perfectly.\n"
    "Remove the background and replace it with a clean, seamless #f5f5f5 light grey "
    "studio backdrop.\n"
    "Change the lighting to professional, high-end editorial studio lighting."
)

ENV_PATH = Path(os.path.expanduser("~/.kun/claire-ai/.env.local"))


def load_env(path=ENV_PATH):
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def need(name):
    value = os.environ.get(name)
    if not value:
        raise RuntimeError("missing env " + name)
    return value


def data_root():
    override = os.environ.get("STYLING_DATA_DIR", "").strip()
    if override:
        return Path(os.path.expanduser(override))
    profile = os.environ.get("DSH_PROFILE_DIR", "").strip()
    if not profile:
        profile = os.path.expanduser("~/Library/Application Support/Mitsumeru/mitsu-dsh/profiles/mitsu")
    return Path(profile) / "styling"


def now():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def read_json(path, default=None):
    try:
        return json.loads(path.read_text())
    except Exception:
        return default


def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + "." + str(os.getpid()) + ".part")
    temporary.write_text(json.dumps(value, indent=2) + "\n")
    os.replace(temporary, path)


def upload(path):
    cloud = need("CLOUDINARY_CLOUD_NAME")
    api_key = need("CLOUDINARY_API_KEY")
    secret = need("CLOUDINARY_API_SECRET")
    timestamp = int(time.time())
    params = {"timestamp": timestamp, "folder": "hmu-styling"}
    signature = __import__("hashlib").sha1(
        ("&".join(f"{key}={params[key]}" for key in sorted(params)) + secret).encode()
    ).hexdigest()
    with open(path, "rb") as handle:
        response = requests.post(
            f"https://api.cloudinary.com/v1_1/{cloud}/image/upload",
            data={"api_key": api_key, "signature": signature, **params},
            files={"file": (path.name, handle)},
            timeout=180,
        )
    response.raise_for_status()
    return response.json()["secure_url"]


def run_rh(nodes, timeout_min=15):
    key = need("VITE_RUNNINGHUB_EXTRACTOR_KEY")
    response = requests.post(
        f"https://www.runninghub.ai/openapi/v2/run/ai-app/{APP_ID}",
        json={"nodeInfoList": nodes},
        headers={"Authorization": f"Bearer {key}"},
        timeout=60,
    )
    body = response.json()
    task_id = body.get("taskId") or (body.get("data") or {}).get("taskId")
    if not task_id:
        return {"error": "no taskId: " + json.dumps(body)[:400]}
    deadline = time.time() + timeout_min * 60
    while time.time() < deadline:
        poll = requests.post(
            "https://www.runninghub.ai/task/openapi/outputs",
            json={"apiKey": key, "taskId": task_id},
            timeout=60,
        ).json()
        code = poll.get("code")
        data = poll.get("data")
        if code == 0 and data:
            outputs = [entry for entry in data if isinstance(entry, dict) and entry.get("fileUrl")]
            if outputs:
                return {"url": outputs[0]["fileUrl"], "taskId": task_id}
        if code == 804:
            time.sleep(10)
            continue
        if code not in (0, 804):
            return {"error": "RH failed: " + json.dumps(poll)[:400]}
        time.sleep(10)
    return {"error": "timeout"}


def extension_of(url):
    path = re.sub(r"\?.*$", "", url or "")
    suffix = Path(path).suffix.lower()
    return suffix if suffix in (".png", ".jpg", ".jpeg", ".webp") else ".jpg"


def looks_in_queue(manifest, job):
    by_id = {look["id"]: look for look in manifest.get("looks", [])}
    queue = []
    for look_id in job.get("looks", []):
        look = by_id.get(look_id)
        if look:
            queue.append(look)
    return queue


def plan_for(look, models_dir, model):
    num = int(look["num"])
    final_dir = Path(look["finalDir"])
    final = final_dir / f"look-{num:03d}.png"
    return {
        "look": look,
        "original": Path(look["coverOriginal"]),
        "model_ref": models_dir / f"{model}_full.png",
        "final": final,
        "final_dir": final_dir,
    }


def archive_existing(final_dir, stem):
    """Archive every previous final with this stem, whatever its extension.

    The URL's extension decides the new file's extension, so the old one may be
    `.png` while the new is `.jpg`. Globbing the stem and skipping the archived
    names catches both without ever archiving the new file.
    """
    if not final_dir.exists():
        return []
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    archived = []
    for old in sorted(final_dir.glob(stem + ".*")):
        if old.stem != stem:
            continue
        archive = old.with_name(old.stem + "_r" + stamp + old.suffix)
        old.rename(archive)
        archived.append(archive)
    return archived


def main():
    parser = argparse.ArgumentParser(description="Style the looks queued in the PLP.")
    parser.add_argument("--run", action="store_true", help="spend a coin per look (default: dry run)")
    parser.add_argument("--limit", type=int, default=0, help="style at most N looks")
    parser.add_argument("--only", default="", help="comma-separated look ids, e.g. look-001,look-007")
    parser.add_argument("--all", action="store_true", help="ignore the queue and use every look")
    parser.add_argument("--model", default="asian", choices=["asian", "blonde", "indian"], help="model reference")
    parser.add_argument("--data-root", default="", help="override <profile>/styling")
    args = parser.parse_args()

    load_env()
    root = Path(os.path.expanduser(args.data_root)) if args.data_root else data_root()
    manifest = read_json(root / "manifest.json")
    if not manifest or not manifest.get("looks"):
        print("No manifest at " + str(root / "manifest.json") + " — add the folder in the Styling tab first.")
        return 2

    if args.all:
        queue = list(manifest["looks"])
        job = None
    else:
        job = read_json(root / "job.json")
        if not job or not job.get("looks"):
            print("No queue. Press re-generate in the Styling tab first, or pass --all.")
            return 2
        queue = looks_in_queue(manifest, job)
    if args.only:
        wanted = {part.strip() for part in args.only.split(",") if part.strip()}
        queue = [look for look in queue if look["id"] in wanted]
    if args.limit > 0:
        queue = queue[: args.limit]

    models_dir = Path(__file__).resolve().parent.parent / "assets" / "models"
    model_ref = models_dir / f"{args.model}_full.png"
    if not model_ref.exists():
        print("Missing model reference: " + str(model_ref))
        return 2

    print("")
    print(f"{'look':10} {'original':34} {'model':16} {'final':34} cost")
    print("-" * 108)
    total = 0
    for look in queue:
        plan = plan_for(look, models_dir, args.model)
        if not plan["original"].exists():
            print(f"{look['id']:10} {'MISSING ' + plan['original'].name:34}")
            continue
        print(
            f"{look['id']:10} {plan['original'].name:34} {model_ref.name:16} "
            f"{plan['final'].name:34} ${EST_COST:.3f}"
        )
        total += EST_COST
    print("-" * 108)
    print(f"{len(queue)} look(s) · ~${total:.2f} · ~{len(queue) * 45 // 60 or 1}–{len(queue) * 90 // 60 or 1} min")
    if not args.run:
        print("")
        print("Dry run: no upload, no RunningHub call, no coin. Add --run to style the queue.")
        return 0
    if not queue:
        return 0

    if job:
        job["status"] = "running"
        job["startedAt"] = now()
        job["done"] = 0
        job["current"] = None
        write_json(root / "job.json", job)

    state = read_json(root / "state.json") or {"schema": "muen-styling-state/v1", "looks": {}}
    state.setdefault("looks", {})
    failures = []
    done = 0
    for index, look in enumerate(queue):
        plan = plan_for(look, models_dir, args.model)
        look_id = look["id"]
        print("")
        print(f"[{index + 1}/{len(queue)}] {look_id} · {plan['original'].name}")
        try:
            if job:
                job["current"] = look_id
                write_json(root / "job.json", job)
            original_url = upload(plan["original"])
            model_url = upload(plan["model_ref"])
            result = run_rh(
                [
                    {"nodeId": NODE_IMAGE_1, "fieldName": "image", "fieldValue": original_url},
                    {"nodeId": NODE_IMAGE_2, "fieldName": "image", "fieldValue": model_url},
                    {"nodeId": NODE_PROMPT, "fieldName": "text", "fieldValue": SWAP_PROMPT},
                ]
            )
            if "error" in result:
                raise RuntimeError(result["error"])
            response = requests.get(result["url"], timeout=180)
            response.raise_for_status()
            plan["final_dir"].mkdir(parents=True, exist_ok=True)
            suffix = extension_of(result["url"])
            final = plan["final"].with_suffix(suffix)
            for old in archive_existing(plan["final_dir"], final.stem):
                print("  archived " + old.name)
            final.write_bytes(response.content)
            # The VL label for the final the loop just wrote: the cover view. The
            # probe pairs finals by view, so an unlabelled loop output would fall
            # back to file order.
            cover_view = "front"
            for pair in look.get("views", []):
                if pair.get("original") == look.get("coverOriginal") and pair.get("view"):
                    cover_view = pair["view"]
                    break
            views_path = plan["final_dir"] / "views.json"
            try:
                view_map = json.loads(views_path.read_text()) if views_path.exists() else {}
                if not isinstance(view_map, dict):
                    view_map = {}
            except Exception:
                view_map = {}
            view_map[final.name] = cover_view
            views_path.write_text(json.dumps(view_map, indent=2) + "\n")
            entry = state["looks"].setdefault(look_id, {})
            # A NEW FINAL IS NOT AN APPROVAL. The loop writes the cover view (view 0);
            # that view goes back to review while any other approved view keeps its
            # decision.
            count = len(look.get("views") or []) or 4
            approvals = entry.get("viewApprovals")
            if not isinstance(approvals, list) or len(approvals) != count:
                approvals = [False] * count
            approvals[0] = False
            entry["viewApprovals"] = approvals
            entry["approved"] = any(approvals)
            entry["reviewed"] = False
            entry.setdefault("runs", []).append(
                {
                    "at": now(),
                    "workflow": "qwen-aio",
                    "path": str(final),
                    "cost": EST_COST,
                    "taskId": result.get("taskId"),
                    "model": args.model,
                }
            )
            write_json(root / "state.json", state)
            done += 1
            if job:
                job["done"] = done
                write_json(root / "job.json", job)
            print("  saved " + str(final) + f" · {len(response.content) // 1024} KB")
        except Exception as error:  # noqa: BLE001 - one look fails, the rest continue
            failures.append({"id": look_id, "error": str(error)})
            print("  FAILED " + str(error))

    if job:
        job["status"] = "done" if not failures else "done-with-errors"
        job["finishedAt"] = now()
        job["current"] = None
        job["failures"] = failures
        write_json(root / "job.json", job)
    print("")
    print(f"done: {done} styled, {len(failures)} failed")
    if failures:
        for failure in failures:
            print("  " + failure["id"] + ": " + failure["error"])
    print("Press refresh in the Styling tab to pick up the new finals.")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
