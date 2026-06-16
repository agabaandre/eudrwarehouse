FROM apache/superset:3.1.3

USER root
RUN pip install --no-cache-dir pymysql psycopg2-binary

COPY superset_config.py /app/pythonpath/superset_config.py
COPY init-superset.sh /app/init-superset.sh
COPY setup_connections.py /app/setup_connections.py
RUN chmod +x /app/init-superset.sh

USER superset

ENV SUPERSET_CONFIG_PATH=/app/pythonpath/superset_config.py
ENV PYTHONPATH=/app/pythonpath

ENTRYPOINT ["/bin/bash", "/app/init-superset.sh"]
