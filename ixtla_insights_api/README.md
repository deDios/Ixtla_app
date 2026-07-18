# Ixtla Insights API

Servicio aislado para la siguiente fase de herramientas y metricas de Insights. El navegador no llama a Python directamente: utiliza los gateways protegidos en `db/ixtla_insights/`.

## Primer test local

1. Crea y activa un entorno virtual desde esta carpeta.
2. Instala dependencias con `python -m pip install -r requirements.txt`.
3. Copia `.env.example` como `.env`. El primer test funciona sin token; define uno cuando quieras proteger el puerto Python.
4. Inicia el servicio con `python -m uvicorn app.main:app --host 127.0.0.1 --port 8011 --reload` cuando se vaya a probar la fase de herramientas.

La primera prueba UAT del chat no requiere este proceso Python: `db/ixtla_insights/chat.php` reutiliza directamente y de forma exclusiva la configuracion de OpenAI que ya usa el scanner de INE en `PRI/.env`.

Por defecto el servicio responde en modo `heuristic`: permite probar el contrato, las visualizaciones permitidas y los endpoints sin exponer una clave ni realizar llamadas al proveedor.

Para activar GPT-5.4 en local, configura `IXTLA_INSIGHTS_ENABLE_OPENAI=true`, `OPENAI_API_KEY` y `OPENAI_MODEL=gpt-5.4` en el entorno Python. Configura la misma URL, el mismo token y `IXTLA_INSIGHTS_ENABLED=true` en el entorno PHP mediante `IXTLA_INSIGHTS_API_URL`, `IXTLA_INSIGHTS_SERVICE_TOKEN` e `IXTLA_INSIGHTS_ENABLED`.

## Limites del primer corte

Este corte no ejecuta SQL ni guarda dashboards en el servidor. Su objetivo es validar el contrato `chat -> respuesta estructurada -> WidgetSpec`. Las consultas de requerimientos se agregaran como herramientas controladas en la siguiente fase.
