// /JS/api/endpoints.js
export const API = {
  // === Requerimiento ===
  REQUERIMIENTO: {
    CREATE: "ixtla-app.com/db/WEB/ixtla01_in_requerimiento.php",
    UPDATE: "ixtla-app.com/db/WEB/ixtla01_upd_requerimiento.php",
    GET:    "ixtla-app.com/db/WEB/ixtla01_c_requerimiento.php",
  },

  // === Comentarios ===
  COMENTARIOS: {
    CREATE: "ixtla-app.com/db/WEB/ixtla01_i_comentario_requerimiento.php",
    UPDATE: "ixtla-app.com/db/WEB/ixtla01_u_comentario_requerimiento.php",
    LIST:   "ixtla-app.com/db/WEB/ixtla01_c_comentario_requerimiento.php",
  },

  // === Procesos ===
  PROCESOS: {
    CREATE: "ixtla-app.com/db/WEB/ixtla01_i_proceso_requerimiento.php",
    UPDATE: "ixtla-app.com/db/WEB/ixtla01_u_proceso_requerimiento.php",
    LIST:   "ixtla-app.com/db/WEB/ixtla01_c_proceso_requerimiento.php",
  },

  // === Tareas ===
  TAREAS: {
    // DB/WEB/ixtla01_i_tarea_proceso.php
    CREATE: "ixtla-app.com/DB/WEB/ixtla01_i_tarea_proceso.php",
    UPDATE: "ixtla-app.com/db/WEB/ixtla01_u_tarea_proceso.php",
    LIST:   "ixtla-app.com/db/WEB/ixtla01_c_tarea_proceso.php",
  },

  // === Empleado ===
  EMPLEADOS: {
    GET:    "ixtla-app.com/db/WEB/ixtla01_c_empleado.php",
  },

  // === Media ===
  MEDIA: {
    // DB\WEB\ixtla01_c_requerimiento_img.php
    GET:    "ixtla-app.com/DB/WEB/ixtla01_c_requerimiento_img.php",
    // DB\WEB\ixtla01_in_requerimiento_img.php
    UPLOAD: "ixtla-app.com/DB/WEB/ixtla01_in_requerimiento_img.php",
  },
};
