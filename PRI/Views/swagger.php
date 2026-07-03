<?php
require_once __DIR__ . '/../JS/auth/ix_guard.php';

ix_require_session([
    'login_url' => '/PRI/Views/login.php'
]);
?>
<!DOCTYPE html>
<html lang="es">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ixtla API Docs</title>
    <link rel="icon" href="/favicon.ico">
    <link rel="preconnect" href="https://unpkg.com">
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
    <style>
        :root {
            color-scheme: light;
            --ix-bg: #f4f1ea;
            --ix-surface: #fffdf9;
            --ix-border: #d8d0c3;
            --ix-ink: #1e1b18;
            --ix-muted: #6d655d;
            --ix-accent: #8b1e2d;
        }

        * {
            box-sizing: border-box;
        }

        body {
            margin: 0;
            font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
            background:
                radial-gradient(circle at top left, rgba(139, 30, 45, 0.12), transparent 32%),
                linear-gradient(180deg, #f6f1e8 0%, #f0ece4 100%);
            color: var(--ix-ink);
        }

        .swagger-shell {
            min-height: 100vh;
            padding: 24px;
        }

        .swagger-header {
            max-width: 1200px;
            margin: 0 auto 20px;
            padding: 20px 24px;
            border: 1px solid var(--ix-border);
            border-radius: 18px;
            background: rgba(255, 253, 249, 0.94);
            backdrop-filter: blur(8px);
            box-shadow: 0 18px 50px rgba(30, 27, 24, 0.08);
        }

        .swagger-kicker {
            margin: 0 0 8px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.16em;
            text-transform: uppercase;
            color: var(--ix-accent);
        }

        .swagger-header h1 {
            margin: 0 0 8px;
            font-size: clamp(28px, 4vw, 42px);
            line-height: 1.05;
        }

        .swagger-header p {
            margin: 0;
            max-width: 760px;
            color: var(--ix-muted);
        }

        .swagger-links {
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-top: 16px;
        }

        .swagger-link {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 10px 14px;
            border: 1px solid var(--ix-border);
            border-radius: 999px;
            background: #fff;
            color: var(--ix-ink);
            text-decoration: none;
            font-weight: 600;
        }

        .swagger-link:hover {
            border-color: var(--ix-accent);
            color: var(--ix-accent);
        }

        #swagger-ui {
            max-width: 1200px;
            margin: 0 auto;
            border: 1px solid var(--ix-border);
            border-radius: 18px;
            overflow: hidden;
            background: var(--ix-surface);
            box-shadow: 0 18px 50px rgba(30, 27, 24, 0.08);
        }

        .swagger-ui .topbar {
            display: none;
        }

        .swagger-ui .information-container {
            padding-top: 12px;
        }

        .swagger-ui .scheme-container {
            box-shadow: none;
            border-bottom: 1px solid #ece5d9;
            background: #fbf8f2;
        }

        .swagger-ui .opblock.opblock-post {
            border-color: rgba(139, 30, 45, 0.35);
        }

        .swagger-ui .opblock.opblock-post .opblock-summary-method {
            background: var(--ix-accent);
        }

        .swagger-empty {
            max-width: 1200px;
            margin: 16px auto 0;
            padding: 14px 16px;
            border: 1px solid #e3b7bd;
            border-radius: 14px;
            background: #fff2f4;
            color: #6b1220;
        }
    </style>
</head>

<body>
    <main class="swagger-shell">
        <section class="swagger-header">
            <p class="swagger-kicker">Swagger UI</p>
            <h1>Documentacion inicial de APIs RED</h1>
            <p>
                Esta vista consume el contrato OpenAPI del proyecto y documenta primero
                los endpoints reales que ya usa el frontend. El spec fuente vive en
                <code>/PRI/docs/openapi.yaml</code>.
            </p>

            <div class="swagger-links">
                <a class="swagger-link" href="/PRI/docs/openapi.yaml" target="_blank" rel="noopener">
                    Ver YAML
                </a>
                <a class="swagger-link" href="/PRI/Views/home.php">
                    Volver al panel RED
                </a>
            </div>
        </section>

        <div id="swagger-ui"></div>

        <div id="swagger-empty" class="swagger-empty" hidden>
            No se pudo cargar Swagger UI. Revisa que el navegador tenga acceso a los assets del CDN
            o considera servirlos localmente mas adelante.
        </div>
    </main>

    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
        (function initSwagger() {
            if (!window.SwaggerUIBundle) {
                document.getElementById("swagger-empty").hidden = false;
                return;
            }

            window.ui = window.SwaggerUIBundle({
                url: "/PRI/docs/openapi.yaml?v=20260702",
                dom_id: "#swagger-ui",
                deepLinking: true,
                docExpansion: "list",
                displayRequestDuration: true,
                filter: true,
                persistAuthorization: true,
                presets: [
                    window.SwaggerUIBundle.presets.apis,
                    window.SwaggerUIStandalonePreset
                ],
                layout: "BaseLayout"
            });
        })();
    </script>
</body>

</html>
