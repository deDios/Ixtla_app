**Comparación de cambios_contexto_datasets.docx contra UAT**

Revisión: 10 de septiembre de 2026. Referencia: código local de `main`, commit `a1462a8` (2026-09-10 01:26:50 -0600). El usuario confirmó que la referencia es el código UAT de este repositorio. No se verificaron Azure, datos reales ni respuestas de un modelo en ejecución.

Documento: `C:/Users/jacks/Desktop/cambios_contexto_datasets.docx`. SHA-256: `1354ACC82865E004A7C51DE90D7C9F37178F35D4C16CE6A224183B76FB6FB06A`.

**Actualización posterior a la revisión:** los parches aceptados se aplicaron después de elaborar esta línea base. La matriz conserva el estado previo para mostrar qué discrepancias originaron el trabajo. La implementación final incorporó además las correcciones señaladas aquí: negaciones y precedencia temporal en retros, agrupación y orden por la fecha seleccionada, tasas no aplicables para conjuntos de respuestas, continuidad de filtros, semana anterior, protección del significado operativo de `fecha_limite` y propagación de `date_field` a visualizaciones.

Se revisó el contenido completo del Word: 703 párrafos con texto, incluidas sus tablas. El paquete no contiene imágenes, notas al pie ni comentarios. Las expresiones «Reemplazar por» y «regla confirmada» se trataron como contenido de la propuesta, no como autorización inicial para modificar la aplicación. El Word no se editó; el código se modificó posteriormente por solicitud expresa del usuario.

**Dictamen**

El documento identifica inconsistencias reales, pero necesita actualizarse antes de convertirse en un plan de implementación. Mezcla correcciones técnicas, decisiones funcionales nuevas, fragmentos desactualizados y cambios a funciones antiguas que no están registradas como herramientas del chat actual.

Los cuatro cambios de su sección 3.6 ya están resueltos funcionalmente en el snapshot UAT, con protecciones adicionales. Los cambios sobre retroalimentaciones aún faltan, pero los fragmentos propuestos omiten agrupaciones temporales, continuidad de filtros y casos de negación. Además, dos afirmaciones del diccionario —que `fecha_limite` no se usa y que departamento/trámite no cambian— contradicen rutas operativas del código UAT.

Las rutas de evidencia siguientes son relativas a la raíz del repositorio. Las líneas corresponden al commit inspeccionado.

**Matriz de los 27 cambios explícitos**

En esta tabla, «Pendiente» significa que la propuesta no está implementada; no implica que deba aprobarse o aplicarse literalmente. El prefijo `I/` abrevia `db/UAT/ixtla_insights/`.

| Sección / cambio | Propuesta | Estado frente a UAT | Evidencia y observación |
|---|---|---|---|
| 3.1 / 1 | Perfil 19 → 20 | Pendiente | `I/domain_profile.php:18` conserva 19. Versionar cuando se concrete el cambio de reglas. |
| 3.1 / 2 | Explicitar abiertos 0–3; separar pausados y cancelados | Parcial en comportamiento | El texto de `I/domain_profile.php:36` no explicita toda esa distinción, pero `:93` ya define activos 0–3 y el snapshot la aplica. |
| 3.1 / 3 | Permitir `updated_at` como respuesta en retros contestadas | Cambio funcional pendiente | `I/domain_profile.php:46` lo prohíbe expresamente. La confiabilidad del dato requiere revisar también su escritura. |
| 3.1 / 4 | Creación por defecto para cerrados; cierre solo explícito | Cambio funcional pendiente | `I/domain_profile.php:56` actualmente orienta a cierre para finalizados durante un intervalo. No es solo una corrección de redacción. |
| 3.1 / 5 | Grupos `paused`, `cancelled`, `finalized` | Pendiente en perfil | `I/domain_profile.php:92` tiene `active`, `paused_or_cancelled`, `closed`. El snapshot ya distingue los tres grupos por separado. |
| 3.1 / 6 | Explicar fecha seleccionable en retros | Pendiente | La guía actual filtra por creación; debe cambiar coordinadamente con contrato, ejecución y seguimientos. |
| 3.2 / 1 | `this_week` en helper SQL base | Pendiente | `I/datasets/scope_service.php:174`. Con `this_week` no añade condición temporal. |
| 3.3 / 1 | Cambiar detector temporal de requerimientos | Pendiente, insuficiente por sí solo | `I/question_router.php:82`. El helper interviene en rangos; los presets de `:340` pueden conservar la fecha enviada por el modelo. |
| 3.3 / 2 | Helper temporal de retros | No existe; propuesta necesita ajustes | El regex propuesto interpreta «no contestadas» como fecha de respuesta y tampoco prioriza una petición explícita de creación. |
| 3.3 / 3 | Completar `date_field` de herramientas retro | Pendiente | `I/question_router.php:322` no lo completa. Debe conservarlo también al continuar resultados, en `:496`. |
| 3.4 / 1 | Añadir `date_field` a filtros y campos requeridos | Pendiente | `I/tools/tool_registry.php:31` y `:44`. Las cuatro herramientas retro filtrables carecen del campo. |
| 3.4 / 2 | Descripciones nuevas de herramientas retro | Pendiente | `I/tools/tool_registry.php:48`. La descripción de overview se refiere exclusivamente a creación. Actualizar también las otras tres. |
| 3.5 / 1 | Normalizador acepta `this_week` | Pendiente en funciones antiguas | `I/datasets/requerimientos_dataset.php:900` convierte `this_week` en `all`. |
| 3.5 / 2 | Helper por campo acepta `this_week` | Pendiente en funciones antiguas | `I/datasets/requerimientos_dataset.php:818`. Falta además contemplar la comparación con la semana anterior. |
| 3.5 / 3 | Corregir abiertos y fecha en comparación | Pendiente en función antigua | `I/datasets/requerimientos_dataset.php:296`; líneas 311–320 incluyen Pausado en abiertos y usan cierre para `closed_count`. |
| 3.5 / 4 | Corregir `open_count` analítico | Pendiente en función antigua | `I/datasets/requerimientos_dataset.php:649` conserva `NOT IN (5, 6)`. |
| 3.5 / 5 | Retirar `deadline_state` | Pendiente en función antigua | `I/datasets/requerimientos_dataset.php:554`. No es un filtro del registro vigente de herramientas. |
| 3.5 / 6 | Retirar `fecha_limite` / `due_at` de safe records | Pendiente en función antigua | `I/datasets/requerimientos_dataset.php:512`, `:523`, `:544`. El documento omite otra salida vigente del mismo dato: `started_at` en snapshot. |
| 3.5 / 7 | Retirar `deadline_risk` | Pendiente en función antigua | `I/datasets/requerimientos_dataset.php:110`. No se encontró una llamada a esta función desde el flujo UAT inspeccionado. |
| 3.6 / 1 | Snapshot 6 → 7 | Ya implementado | `I/datasets/requerimientos_snapshot.php:53` y `:220` ya usan 7. |
| 3.6 / 2 | Añadir `closed_date` / `closed_at_unix` | Ya implementado, con más protección | `I/datasets/requerimientos_snapshot.php:154` normaliza cierre solo para Finalizado y registra problemas de calidad. |
| 3.6 / 3 | Filtrar presets con la fecha seleccionada | Ya implementado | `I/datasets/requerimientos_snapshot.php:311` y `:320`. También excluye cierres ausentes o inválidos. |
| 3.6 / 4 | Agrupar por creación o cierre | Ya implementado | `I/datasets/requerimientos_snapshot.php:726`; también en agrupación multidimensional, `:823`. |
| 3.7 / 1 | Helpers de fecha retro | Pendiente | No existen. El helper propuesto convierte valores inválidos a creación; conviene mantener una validación coherente con el contrato estricto. |
| 3.7 / 2 | Filtro retro por creación o actualización | Pendiente | `I/datasets/retroalimentaciones_dataset.php:41` siempre filtra `rc.created_at`. La propuesta debe resolver negaciones y la precedencia de rangos. |
| 3.7 / 3 | `date_basis` dinámico | Pendiente | Las cuatro salidas dicen creación. Cambiar la etiqueta sin cambiar también la agrupación produciría evidencia contradictoria. |
| 3.8 / 1 | Actualizar pruebas temporales | Pendiente e incompleto | `I/tests/diagnostics_test.php:447` y `:507` esperan cierre. También hay aserciones de prompt incompatibles con las nuevas redacciones. |

**Hallazgos prioritarios y omisiones del documento**

1. **`fecha_limite` sí tiene uso operativo en UAT, como inicio de atención.** En `JS/UAT/api/requerimientos.js:493` se mapea `fecha_inicio` a `fecha_limite`; en `:528` se rellena automáticamente en determinadas transiciones. `JS/UAT/ui/requerimientoDetalle.js:553` la utiliza para mostrar «Fecha de inicio». El snapshot la lee en `I/datasets/requerimientos_snapshot.php:111`, la publica como `started_at` en `:153` y `:384`, y la describe como inicio en `:240`. Al mismo tiempo, `I/domain_profile.php:64` ordena no presentarla siquiera como inicio. Existe una contradicción real, pero eliminar vencimientos de funciones antiguas no la resuelve. Debe precisarse si se quiere excluir el campo solo de Insights o cambiar también su uso operativo. No equivale a borrar la columna de la base de datos.

2. **No se deben reemplazar literalmente los bloques del snapshot.** Ya están en versión 7 y diferencian fechas de creación y cierre. La propuesta de normalización calcula cierre sin condicionar por estatus Finalizado. Si se impusiera sobre la implementación actual, perdería la protección que impide contar como cerrado un registro todavía En proceso con una fecha residual. También debe conservarse la exclusión de cierres inválidos incluso con `period=all`. Para otro cambio de esquema futuro, una nueva invalidación de caché requeriría evaluar una versión posterior a 7.

3. **La semántica de “cerrados este mes” cambia el universo medido.** El documento pide contar requerimientos creados en el mes que actualmente están Finalizados. Eso es distinto de contar finalizaciones ocurridas en el mes. Ejemplo: un requerimiento creado en agosto y finalizado en septiembre entra en «cierres de septiembre» por fecha de cierre, pero queda fuera del conteo propuesto de finalizados creados en septiembre. Ambas consultas son posibles; las respuestas deben expresar su base temporal en lenguaje de usuario.

4. **El cambio de helper temporal no fuerza la nueva regla en todos los caminos.** En `I/question_router.php:340`, los presets como «este mes» conservan un `date_field` válido enviado por el modelo y, si no lo hay, usan creación. Con una prueba directa, «requerimientos cerrados este mes» mantuvo `closed_at` cuando se suministró ese argumento; «requerimientos cerrados por fecha de cierre este mes» quedó en `created_at` cuando no se suministró. Modificar solo el helper usado por rangos no elimina esa dependencia. Hay que cubrir presets, rangos, consultas de comparación y continuidad conversacional.

5. **La detección propuesta para retros confunde negaciones y criterios explícitos.** Su regex devuelve `updated_at` tanto para «retros no contestadas esta semana» como para «retros creadas este mes que ya están contestadas». En el primer caso, si los estados son `[1]`, el SQL propuesto arrojaría una excepción; si no se proporcionan estados, forzaría `[2]` y consultaría el universo contrario. En el segundo, desplazaría la fecha de creación solicitada hacia actualización. Se requiere precedencia de intención explícita, manejo de negaciones y pruebas con lenguaje real.

6. **Falta cambiar la agrupación temporal de retroalimentaciones.** `I/datasets/retroalimentaciones_dataset.php:120` fija `group_by=date` a `DATE(rc.created_at)`. Después de los cambios del Word, sería posible filtrar por respuestas actualizadas en septiembre y graficarlas en las fechas de creación de agosto. Cambiar únicamente el filtro y `date_basis` dejaría esa discrepancia. También debe definirse qué significa «recientes» al muestrear comentarios: hoy se ordenan por creación (`:227`) y se devuelve solo esa fecha en la muestra.

7. **Las tasas de respuesta necesitan un tratamiento específico al filtrar solo contestadas.** En `I/datasets/retroalimentaciones_dataset.php:95`, la tasa general es contestadas/total filtrado y la elegible es contestadas/(pendientes + contestadas). Si `updated_at` fuerza que todas las filas sean Contestadas, ambas serán 100 % para un conjunto no vacío. Eso describe el conjunto filtrado, no la efectividad de las invitaciones del periodo. La propuesta debe decidir si omite esas tasas, las marca como no aplicables o consulta por separado una cohorte de invitaciones definida.

8. **Los seguimientos de retroalimentaciones no preservan todos los filtros necesarios.** `I/question_router.php:509` hereda `period`, `date_from` y `date_to`, pero no `date_field`. «Muéstrame las siguientes» podría cambiar de fecha de respuesta a creación tras añadir el nuevo campo. Además, `I/conversation_state.php:112` no guarda `rating_ids`, `requirement_status_ids` ni `page`, aunque el router intenta reutilizarlos. Es una omisión existente que el documento no cubre y que debe contemplarse al ampliar las consultas retro.

9. **`this_week` no queda completamente cubierto por los tres cambios descritos.** El normalizador y los dos filtros SQL necesitan el ajuste, pero `I/datasets/requerimientos_dataset.php:829` tampoco acepta semana en curso para el periodo anterior. La función de comparación de `:296` tiene validación propia de periodos, y `ixtla_insights_dataset_risk_period()` conserva otra lista. Si se pretende extender esas funciones, se debe decidir explícitamente cómo comparar semana parcial actual contra semana anterior.

10. **El impacto de las funciones antiguas no debe confundirse con el del chat vigente.** `I/tools/tool_registry.php:246` dirige las consultas actuales de requerimientos a snapshot y las de retroalimentación a SQL. Las funciones `period_comparison`, `analytics_query`, `safe_records` y `operational_risk_snapshot` del dataset antiguo no figuran en ese despacho; las búsquedas en código actual no encontraron llamadas externas a ellas. Son inconsistencias que conviene corregir o retirar, pero no demuestran que el chat actual esté incluyendo Pausado en todos sus conteos. El snapshot actual ya excluye Pausado de activos.

11. **El diccionario afirma invariantes que el código operativo no garantiza.** `db/WEB/ixtla01_upd_requerimiento.php:154` permite editar departamento y trámite en Solicitud/Revisión, y contiene reglas diferentes para departamentos sensibles. El UPDATE de `:221` escribe ambos. UAT consume ese endpoint desde `JS/UAT/ui/requerimientoDetalle.js:29`. Por tanto, «no cambia después de creado» no describe la implementación actual. Para `updated_at` de retro, `db/WEB/ixtla01_u_retro.php:29` permite actualizar estado, comentario, calificación y enlace; el SQL no establece una fecha de respuesta independiente. La UI limita algunas acciones sobre contestadas, pero el código inspeccionado no demuestra que toda actualización de una contestada sea su respuesta original. Sin inspeccionar esquema/triggers y datos no se puede afirmar la inmutabilidad de esa fecha.

12. **Las pruebas propuestas y su texto necesitan completarse.** El Word cambia pruebas de cierre, pero no actualiza la aserción de `I/tests/diagnostics_test.php:74`, que exige que el prompt diga que `updated_at` no es una fecha confiable. También cambia textos comprobados literalmente en `:55`, `:58` y `:73`. Aplicar la propuesta de prompt sin ajustar esas pruebas haría fallar la suite. La explicación final de 3.8 todavía dice «Se espera closed_at para finalizados/cerrados por periodo», aunque los reemplazos exigen creación por defecto. La numeración salta de 3 a 5. Son señales de edición pendiente.

13. **Una pregunta de la matriz no activa hoy herramientas por sí sola.** En una prueba directa del router, «Cuantos cerrados este mes?» produjo `tool_choice=none`, incluso con el indicador de contexto de datos. `I/question_router.php:11` no incluye «cerrados» entre sus referencias al dominio y el detector de seguimiento tampoco cubre esa frase. «Cuantos requerimientos cerrados este mes?» sí permite identificar el dominio. La validación funcional debe cubrir la frase exacta del documento desde intención hasta ejecución; comprobar solo fechas no basta.

Como observación adicional fuera del núcleo de Insights, `JS/UAT/api/requerimientos.js:126` mantiene un helper `isCerrado()` que acepta Cancelado o cualquier `cerrado_en`. No se ha atribuido aquí impacto a una pantalla concreta sin seguir sus consumidores; sí evidencia que una unificación del diccionario para toda la aplicación abarcaría más de los ocho archivos del Word.

**Validación realizada**

Las tres suites existentes se ejecutaron sin cambios:

| Comando | Resultado |
|---|---|
| `php db/UAT/ixtla_insights/tests/diagnostics_test.php` | `OK diagnostics` |
| `php db/UAT/ixtla_insights/tests/endpoint_contract_test.php` | `OK endpoint contracts` |
| `php db/UAT/ixtla_insights/tests/visualization_plan_test.php` | `OK visualization plan` |

Además se ejecutaron comprobaciones temporales fuera del código de la aplicación, con funciones puras y datos sintéticos, sin conectarse a la base:

| Comprobación | Resultado observado |
|---|---|
| Perfil de dominio | Versión 19. |
| Normalizar `this_week` con helper antiguo | Devuelve `all`. |
| Filtro SQL base con `this_week` | No agrega condiciones. |
| Periodo anterior para `this_week` | Lanza «El periodo previo no es válido». |
| Activos del dominio | `[0,1,2,3]`. Pausado no es activo en el snapshot. |
| Caso sintético creado el mes anterior y finalizado este mes | Entra al filtrar por cierre este mes; no entra al filtrar por creación este mes. |
| Registro no finalizado con fecha de cierre residual | Su cierre normalizado es `null`. |
| Publicación de `fecha_limite` | Aparece como `started_at` en la salida pública del snapshot. |
| Contratos de las cuatro herramientas retro con filtros | Ninguno tiene `date_field`. |
| Detector retro propuesto con «no contestadas» | Selecciona incorrectamente `updated_at`. |
| Preset de requerimientos con fecha explícita en la pregunta | Puede conservar una fecha distinta según los argumentos recibidos; falta imposición uniforme. |
| «Dame vencidos o por vencer» | Ya se clasifica como conceptual. |

Que las suites pasen no significa que ya cumplan la propuesta. Verifican el contrato actual, incluidas reglas temporales que el Word quiere reemplazar. Tampoco se midieron porcentajes de afectación en datos reales ni el comportamiento final del modelo.

**Secuencia sugerida para una eventual implementación**

1. Precisar el alcance de `fecha_limite`: uso operativo como inicio frente a exclusión en Insights; corregir las afirmaciones de inmutabilidad y documentar la base temporal de los conteos de cerrados y retros.
2. Actualizar conjuntamente perfil, contratos, selección de fechas, dataset de retros, agrupaciones, tasas y persistencia de filtros. Cubrir negaciones, creación explícita, fechas de respuesta y paginación.
3. Conservar las protecciones ya presentes en el snapshot. Resolver su exposición de `started_at` según el alcance definido y versionar la caché si cambia el esquema.
4. Corregir o retirar funciones antiguas tras verificar sus consumidores, completando la familia de helpers semanales si se conserva.
5. Ampliar las pruebas con los casos de este informe; ejecutar las suites actuales y después validar extremo a extremo en el entorno que se desee desplegar.

En el momento de redactar esta línea base, la entrega era solamente el análisis; los cambios se aplicarían posteriormente por solicitud expresa y no se efectuó despliegue alguno.

**Actualización de implementación posterior a esta línea base (10 de septiembre de 2026):** por solicitud expresa, los ajustes se aplicaron en el código UAT. Se alinearon estados, fechas y cierres con los endpoints y la interfaz operativa: solo Finalizado (6) se considera cerrado para Insights; Cancelado (5) limpia `cerrado_en`; `fecha_limite` conserva el significado operativo de inicio; las retros validan estados 0–3 y calificaciones 1–4; `date_field` y `date_basis` se propagan a filtros, agrupaciones, snapshots y visualizaciones; y la tasa de respuesta usa la cohorte por fecha de creación. También se corrigieron negaciones y consultas mixtas de estados de retro para que no usen `updated_at` fuera del conjunto Contestada.

No se modificaron tablas ni esquema MySQL. Las validaciones actuales devuelven `OK diagnostics`, `OK endpoint contracts` y `OK visualization plan`; todos los archivos PHP UAT y los tres endpoints WEB modificados pasan `php -l`. Node.js no está instalado en el entorno, por lo que no se ejecutó un parser sintáctico de JavaScript. La copia paralela `db/ixtla_insights` de producción no se sincronizó porque la referencia confirmada fue UAT; debe promoverse mediante el procedimiento de despliegue cuando UAT sea aprobado.

**Auditoría de coherencia posterior:** se corrigieron textos que describían como activos todos los registros, aunque el snapshot también contiene pausados, cancelados y finalizados; la interfaz ya describe abiertos como estados 0–3. El catálogo UAT dejó de anunciar `funnel`, `promedio_semanal` y `tiempo_resolucion`, porque no existe una ruta vigente que los calcule/renderice; también se alineó `cerrados` como alias de Finalizado y se agregó `this_week` a la instrucción del modelo. Queda como trabajo funcional separado implementar esas dos métricas KPI si se desean volver a ofrecer.
