#!/usr/bin/env python3
"""Acces en lecture a Google Search Console pour idiocracies.com.

Utilise le meme compte de service que le MCP Google Analytics
(analytics-mcp@windy-raceway-455500-i8.iam.gserviceaccount.com), qui a ete
ajoute comme utilisateur « Acces total » sur les proprietes GSC.

Usage :
    python scripts/gsc.py sites
    python scripts/gsc.py perf [--days 28] [--dim query|page|country|device|date] [--limit 25]
    python scripts/gsc.py sitemaps
    python scripts/gsc.py inspect <url>

Commandes d'ecriture (demandent le scope webmasters, pas seulement readonly) :

    python scripts/gsc.py submit-sitemap <url>
    python scripts/gsc.py delete-sitemap <url>

Note : les donnees GSC accusent ~2 jours de retard, la periode se termine donc
a J-2 par defaut.
"""
import argparse
import datetime as dt
import sys

from google.oauth2 import service_account
from googleapiclient.discovery import build

KEY = r"C:\Users\info\AppData\Roaming\gcloud\sa-analytics-cfrq.json"
SITE = "sc-domain:idiocracies.com"
SCOPE_RO = "https://www.googleapis.com/auth/webmasters.readonly"
SCOPE_RW = "https://www.googleapis.com/auth/webmasters"

# Les commandes d'ecriture demandent le scope complet ; tout le reste reste en
# lecture seule, pour qu'une faute de frappe ne puisse rien modifier.
WRITE_COMMANDS = {"submit-sitemap", "delete-sitemap"}


def service(write=False):
    creds = service_account.Credentials.from_service_account_file(
        KEY, scopes=[SCOPE_RW if write else SCOPE_RO])
    return build("searchconsole", "v1", credentials=creds, cache_discovery=False)


def cmd_sites(svc, _args):
    for s in svc.sites().list().execute().get("siteEntry", []):
        print(f"{s['siteUrl']:<40} {s['permissionLevel']}")


def cmd_perf(svc, args):
    end = dt.date.today() - dt.timedelta(days=2)
    start = end - dt.timedelta(days=args.days - 1)
    body = {"startDate": str(start), "endDate": str(end), "rowLimit": args.limit}
    if args.dim:
        body["dimensions"] = [args.dim]

    rows = svc.searchanalytics().query(siteUrl=args.site, body=body).execute().get("rows", [])
    print(f"# {args.site} | {start} -> {end}" + (f" | par {args.dim}" if args.dim else " | total"))
    if not rows:
        print("  (aucune donnee)")
        return
    for r in rows:
        key = " | ".join(r.get("keys", [])) or "TOTAL"
        print(
            f"  {key[:60]:<60} clics={r['clicks']:<5} impr={r['impressions']:<7} "
            f"ctr={r['ctr'] * 100:5.1f}%  pos={r['position']:.1f}"
        )


def cmd_sitemaps(svc, args):
    sms = svc.sitemaps().list(siteUrl=args.site).execute().get("sitemap", [])
    if not sms:
        print("AUCUN SITEMAP SOUMIS")
        return
    for s in sms:
        print(
            f"{s.get('path')}\n  dernier telechargement={s.get('lastDownloaded', 'jamais')} "
            f"erreurs={s.get('errors', 0)} avertissements={s.get('warnings', 0)}"
        )
        for c in s.get("contents", []):
            print(f"  type={c.get('type')} urls_soumises={c.get('submitted')}")


def cmd_inspect(svc, args):
    res = svc.urlInspection().index().inspect(
        body={"inspectionUrl": args.url, "siteUrl": args.site, "languageCode": "fr"}
    ).execute()
    r = res.get("inspectionResult", {}).get("indexStatusResult", {})
    print(f"# {args.url}")
    for label, key in [
        ("Verdict", "verdict"),
        ("Etat couverture", "coverageState"),
        ("Robots.txt", "robotsTxtState"),
        ("Indexation", "indexingState"),
        ("Canonique Google", "googleCanonical"),
        ("Canonique declaree", "userCanonical"),
        ("Dernier crawl", "lastCrawlTime"),
        ("Decouverte via sitemap", "sitemap"),
        ("Pages referentes", "referringUrls"),
    ]:
        if key in r:
            print(f"  {label:<24} {r[key]}")


def cmd_submit_sitemap(svc, args):
    svc.sitemaps().submit(siteUrl=args.site, feedpath=args.url).execute()
    print(f"soumis : {args.url}")


def cmd_delete_sitemap(svc, args):
    svc.sitemaps().delete(siteUrl=args.site, feedpath=args.url).execute()
    print(f"supprime : {args.url}")


def main():
    p = argparse.ArgumentParser(description="Lecture Google Search Console")
    p.add_argument("--site", default=SITE, help=f"propriete GSC (defaut: {SITE})")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("sites", help="lister les proprietes accessibles")

    perf = sub.add_parser("perf", help="rapport de performance de recherche")
    perf.add_argument("--days", type=int, default=28)
    perf.add_argument("--dim", choices=["query", "page", "country", "device", "date"], default=None)
    perf.add_argument("--limit", type=int, default=25)

    sub.add_parser("sitemaps", help="etat des sitemaps soumis")

    insp = sub.add_parser("inspect", help="inspecter l'indexation d'une URL")
    insp.add_argument("url")

    subm = sub.add_parser("submit-sitemap", help="soumettre un sitemap (ecriture)")
    subm.add_argument("url", help="URL complete du sitemap")

    dele = sub.add_parser("delete-sitemap", help="retirer un sitemap (ecriture)")
    dele.add_argument("url", help="URL complete du sitemap, telle que listee par `sitemaps`")

    args = p.parse_args()
    svc = service(write=args.cmd in WRITE_COMMANDS)
    {
        "sites": cmd_sites,
        "perf": cmd_perf,
        "sitemaps": cmd_sitemaps,
        "inspect": cmd_inspect,
        "submit-sitemap": cmd_submit_sitemap,
        "delete-sitemap": cmd_delete_sitemap,
    }[args.cmd](svc, args)


if __name__ == "__main__":
    sys.exit(main())
