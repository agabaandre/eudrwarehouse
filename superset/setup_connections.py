"""Register Apache Doris and PostgreSQL as Superset data sources."""
import os
import time

from superset.app import create_app

DORIS_HOST = os.environ.get("DORIS_HOST", "doris-fe")
DORIS_PORT = os.environ.get("DORIS_PORT", "9030")
DORIS_DB = os.environ.get("DORIS_DATABASE", "eudr_analytics")
PG_HOST = os.environ.get("POSTGRES_HOST", "postgres")
PG_USER = os.environ.get("POSTGRES_USER", "eudr")
PG_PASS = os.environ.get("POSTGRES_PASSWORD", "eudr_secret")
PG_DB = os.environ.get("POSTGRES_DB", "eudr")

DORIS_URI = f"mysql+pymysql://root@{DORIS_HOST}:{DORIS_PORT}/{DORIS_DB}"
PG_URI = f"postgresql+psycopg2://{PG_USER}:{PG_PASS}@{PG_HOST}:5432/{PG_DB}"


def ensure_database(session, uri, name):
    from superset.models.core import Database

    existing = session.query(Database).filter_by(database_name=name).first()
    if existing:
        print(f"Database connection '{name}' already exists")
        return
    db = Database(database_name=name, sqlalchemy_uri=uri)
    session.add(db)
    session.commit()
    print(f"Registered database connection: {name}")


def main():
  for attempt in range(12):
    try:
      app = create_app()
      with app.app_context():
        from superset import db

        ensure_database(db.session, DORIS_URI, "EUDR Doris Warehouse")
        ensure_database(db.session, PG_URI, "EUDR PostgreSQL OLTP")
      print("Superset data source setup complete")
      return
    except Exception as e:
      print(f"Setup attempt {attempt + 1} failed: {e}")
      time.sleep(5)
  print("Warning: Could not register all data sources — add manually in Superset UI")


if __name__ == "__main__":
  main()
