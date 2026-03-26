# -*- coding: utf-8 -*-
"""
APPsistencia Data Extractor
============================
Extreu totes les dades de la web d'APPsistencia via API.

Endpoints descoberts:
  API JSON (Bootstrap Table server-side):
    - /api/castellers              -> Persones/Castellers (258 registres)
    - /api/assajos                 -> Llistat assajos (74 registres)
    - /api/assajos/{id}            -> Detall assaig (temporada, data, lloc, hora...)
    - /api/actuacions              -> Llistat actuacions (15 registres)
    - /api/actuacions/{id}         -> Detall actuacio (colles, transport, lloc...)
    - /api/assistencies/{id}       -> Assistencia d'un event (nom, estat, instant)
    - /api/dispositius             -> Dispositius/Apps instal-lades (177 reg.)
    - /api/noticies                -> Noticies publicades (9 reg.)
    - /api/checks-acceptacio       -> Checks d'acceptacio

  Exports XLSX:
    - /assistencia-export/{id}     -> Excel amb assistencia detallada per event

  Pagines HTML (no API):
    - /ranquing/?interval=DD/MM/YYYY|DD/MM/YYYY -> Ranquing assistencia

  Login: POST / amb username, password, submitted=1, email_confirm='', phone=''
  Nota: Cal User-Agent real, el servidor bloqueja requests sense UA.
"""

import requests
import json
import re
import os
import time
from html import unescape

BASE_URL = "https://muixerangadebarcelona.appsistencia.cat"
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "../data/extracted")

session = requests.Session()
session.headers.update({
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ca,en;q=0.5",
})


def login(username="estadistiques", password=".AppEst."):
    session.get(f"{BASE_URL}/")
    resp = session.post(f"{BASE_URL}/", data={
        "username": username,
        "password": password,
        "submitted": "1",
        "email_confirm": "",
        "phone": "",
    }, allow_redirects=True)
    return "tancar" in resp.text.lower()


def strip_html(text):
    if not text:
        return ""
    return re.sub(r"<[^>]+>", "", unescape(str(text))).strip()


def extract_event_id(html_cell):
    m = re.search(r'/llista/(\d+)', html_cell)
    return m.group(1) if m else None


def extract_description(desc_html):
    m = re.search(r'>([^<]+)$', desc_html or "")
    return m.group(1).strip() if m else strip_html(desc_html)


def safe_int(val, default=0):
    try:
        return int(val)
    except (ValueError, TypeError):
        return default


# ======================================================================
# 1. CASTELLERS / PERSONES  -  /api/castellers
# ======================================================================
def get_castellers():
    """Retorna totes les persones registrades amb totes les columnes."""
    resp = session.get(f"{BASE_URL}/api/castellers")
    data = resp.json()
    results = []
    for row in data["rows"]:
        clean = {}
        for k, v in row.items():
            if k == "0":
                continue
            clean[k] = strip_html(str(v)) if v else ""
        results.append(clean)
    return results


# ======================================================================
# 2. ASSAJOS  -  /api/assajos + /api/assajos/{id}
# ======================================================================
def get_assajos():
    resp = session.get(f"{BASE_URL}/api/assajos")
    data = resp.json()
    results = []
    for row in data["rows"]:
        results.append({
            "event_id": extract_event_id(row.get("0", "")),
            "temporada": row["temporada"],
            "data": row["data"],
            "hora": row["hora_esdeveniment"],
            "dia_setmana": row["dia_setmana"],
            "descripcio": extract_description(row["descripcio"]),
            "si": safe_int(row["n_si"]),
            "potser": safe_int(row["n_potser"]),
            "no": safe_int(row["n_no"]),
            "canalla": safe_int(row.get("n_canalla")),
            "total": safe_int(row["n_si_tots"]),
            "pct_baixes": row.get("p_mentider", ""),
            "pct_planificades": row.get("p_planificades", ""),
        })
    return results


def get_assaig_detail(event_id):
    resp = session.get(f"{BASE_URL}/api/assajos/{event_id}")
    return resp.json()


# ======================================================================
# 3. ACTUACIONS  -  /api/actuacions + /api/actuacions/{id}
# ======================================================================
def get_actuacions():
    resp = session.get(f"{BASE_URL}/api/actuacions")
    data = resp.json()
    results = []
    for row in data["rows"]:
        results.append({
            "event_id": extract_event_id(row.get("0", "")),
            "temporada": row["temporada"],
            "data": row["data"],
            "hora_autocar": row.get("hora_autocar", ""),
            "hora_cotxe": row.get("hora_cotxe", ""),
            "hora": row["hora_esdeveniment"],
            "dia_setmana": row["dia_setmana"],
            "descripcio": extract_description(row["descripcio"]),
            "resultats": strip_html(row.get("resultats", "") or ""),
            "si": safe_int(row["n_si"]),
            "bus": row.get("n_bus", "-"),
            "potser": safe_int(row["n_potser"]),
            "no": safe_int(row["n_no"]),
            "total": safe_int(row["n_si_tots"]),
        })
    return results


def get_actuacio_detail(event_id):
    resp = session.get(f"{BASE_URL}/api/actuacions/{event_id}")
    return resp.json()


# ======================================================================
# 4. ASSISTENCIES PER EVENT  -  /api/assistencies/{id}
# ======================================================================
def get_assistencies(event_id):
    resp = session.get(f"{BASE_URL}/api/assistencies/{event_id}")
    if resp.status_code != 200:
        return []
    try:
        data = resp.json()
    except Exception:
        return []
    results = []
    for row in data.get("rows", []):
        results.append({
            "id_assistencia": row.get("id_assistencia"),
            "nom": strip_html(row.get("nom_casteller", "")),
            "estat": row.get("estat", ""),
            "instant": row.get("instant", ""),
            "observacions": strip_html(row.get("observacions", "") or ""),
        })
    return results


# ======================================================================
# 5. EXPORT XLSX  -  /assistencia-export/{id}
# ======================================================================
def download_assistencia_excel(event_id, output_path):
    resp = session.get(f"{BASE_URL}/assistencia-export/{event_id}")
    if resp.status_code == 200 and "spreadsheet" in resp.headers.get("content-type", ""):
        with open(output_path, "wb") as f:
            f.write(resp.content)
        return True
    return False


# ======================================================================
# 6. DISPOSITIUS  -  /api/dispositius
# ======================================================================
def get_dispositius():
    resp = session.get(f"{BASE_URL}/api/dispositius")
    data = resp.json()
    return [{k: strip_html(str(v)) for k, v in row.items() if k != "0"} for row in data.get("rows", [])]


# ======================================================================
# 7. NOTICIES  -  /api/noticies
# ======================================================================
def get_noticies():
    resp = session.get(f"{BASE_URL}/api/noticies")
    data = resp.json()
    return [{k: strip_html(str(v)) for k, v in row.items() if k != "0"} for row in data.get("rows", [])]


# ======================================================================
# MAIN
# ======================================================================
def save_json(data, filename):
    path = os.path.join(OUTPUT_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return path


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(os.path.join(OUTPUT_DIR, "assistencies"), exist_ok=True)
    os.makedirs(os.path.join(OUTPUT_DIR, "excel"), exist_ok=True)

    print("[login] Connecting...")
    if not login():
        print("[ERROR] Login failed!")
        return
    print("[OK] Logged in\n")

    # --- Castellers ---
    print("[1/7] Castellers (persones)...")
    castellers = get_castellers()
    save_json(castellers, "castellers.json")
    print(f"  -> {len(castellers)} persones\n")

    # --- Assajos ---
    print("[2/7] Assajos...")
    assajos = get_assajos()
    save_json(assajos, "assajos.json")
    print(f"  -> {len(assajos)} assajos")

    details = {}
    for a in assajos:
        eid = a["event_id"]
        if eid:
            details[eid] = get_assaig_detail(eid)
            time.sleep(0.15)
    save_json(details, "assajos_details.json")
    print(f"  -> {len(details)} details\n")

    # --- Actuacions ---
    print("[3/7] Actuacions...")
    actuacions = get_actuacions()
    save_json(actuacions, "actuacions.json")
    print(f"  -> {len(actuacions)} actuacions")

    act_details = {}
    for a in actuacions:
        eid = a["event_id"]
        if eid:
            act_details[eid] = get_actuacio_detail(eid)
            time.sleep(0.15)
    save_json(act_details, "actuacions_details.json")
    print(f"  -> {len(act_details)} details\n")

    # --- Assistencies ---
    print("[4/7] Assistencies per event...")
    all_ids = [a["event_id"] for a in assajos + actuacions if a["event_id"]]
    count = 0
    for eid in all_ids:
        data = get_assistencies(eid)
        if data:
            path = os.path.join(OUTPUT_DIR, "assistencies", f"event_{eid}.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            count += 1
        time.sleep(0.2)
    print(f"  -> {count}/{len(all_ids)} events amb dades\n")

    # --- Excel exports ---
    print("[5/7] Excel exports...")
    dl = 0
    for eid in all_ids:
        path = os.path.join(OUTPUT_DIR, "excel", f"assistencia_{eid}.xlsx")
        if download_assistencia_excel(eid, path):
            dl += 1
        time.sleep(0.2)
    print(f"  -> {dl} excels\n")

    # --- Dispositius ---
    print("[6/7] Dispositius...")
    dispositius = get_dispositius()
    save_json(dispositius, "dispositius.json")
    print(f"  -> {len(dispositius)} dispositius\n")

    # --- Noticies ---
    print("[7/7] Noticies...")
    noticies = get_noticies()
    save_json(noticies, "noticies.json")
    print(f"  -> {len(noticies)} noticies\n")

    print("=" * 50)
    print("DONE! Output:", OUTPUT_DIR)
    print("=" * 50)


if __name__ == "__main__":
    main()
