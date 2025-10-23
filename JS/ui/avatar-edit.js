// /JS/ui/avatar-edit.js


export function setupAvatarEditButton({
  imgSelector = "#hs-avatar",
  endpoint = "/db/WEB/ixtla01_u_usuario_avatar.php", // endpoint
  session = (window.Session?.get?.() || null),       
} = {}) {
  const img = document.querySelector(imgSelector);
  if (!img) return;

  // Envolver imagen si no está envuelta
  if (!img.closest(".avatar-wrap")) {
    const wrap = document.createElement("div");
    wrap.className = "avatar-wrap";
    img.parentNode.insertBefore(wrap, img);
    wrap.appendChild(img);
  }
  const wrap = img.closest(".avatar-wrap");

  // Evitar duplicado
  if (wrap.querySelector(".avatar-edit")) return;

  // Botón flotante
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "avatar-edit";
  btn.setAttribute("aria-label", "Cambiar foto de perfil");
  btn.title = "Cambiar foto";
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0L15.13 5.12l3.75 3.75 1.83-1.83z"/>
    </svg>`;
  wrap.appendChild(btn);

  // Resolver id de usuario desde Session si está disponible
  const s = session || (window.Session?.get?.() || {});
  const usuarioId = s.id_usuario ?? s.usuario_id ?? s.id_empleado ?? s.empleado_id ?? null;
  if (!usuarioId) {
    btn.disabled = true;
    btn.title = "Inicia sesión para cambiar tu foto";
    return;
  }

  // Handlers
  btn.addEventListener("click", (e) => {
    e.preventDefault(); e.stopPropagation();

    // 1) Si existe editor avanzado, úsalo
    if (typeof window.openEditorDeAvatar === "function") {
      window.openEditorDeAvatar({ usuarioId });
      return;
    }

    // 2) Fallback simple: input file + POST
    let input = document.getElementById("hs-avatar-input");
    if (!input) {
      input = document.createElement("input");
      input.type = "file";
      input.id = "hs-avatar-input";
      input.accept = "image/*";
      input.style.display = "none";
      document.body.appendChild(input);

      input.addEventListener("change", async (ev) => {
        const file = ev.target.files?.[0];
        if (!file) return;
        try {
          await uploadAvatarFallback({ file, usuarioId, endpoint });
          // cache-bust en el <img> actual
          img.src = cacheBust(img.src);
        } catch (err) {
          console.error(err);
          alert("Error al subir la imagen de perfil.");
        } finally {
          input.value = "";
        }
      });
    }
    input.click();
  });
}

function cacheBust(url) {
  const base = url.split("?")[0];
  return base + (base.includes("?") ? "&" : "?") + "t=" + Date.now();
}

async function uploadAvatarFallback({ file, usuarioId, endpoint }) {
  const fd = new FormData();
  fd.append("usuario_id", usuarioId);
  fd.append("avatar", file);

  const res = await fetch(endpoint, { method: "POST", body: fd });
  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.ok) {
    throw new Error(data?.error || "No se pudo actualizar el avatar");
  }

  // Si usas Session para el header global:
  try {
    const cur = window.Session?.get?.() || {};
    const next = { ...cur, avatarUrl: data.url };
    window.Session?.set?.(next);
    window.gcRefreshHeader?.(next);
  } catch {}

  // Actualiza también los posibles avatares del header/mobile
  const bust = (u) => u + (u.includes("?") ? "&" : "?") + "t=" + Date.now();
  document.querySelectorAll(".user-icon-mobile img, .actions .img-perfil").forEach(el => {
    const src = data.url || el.src;
    el.src = bust(src);
  });

  return data;
}

// Auto-init si se importa como módulo sin configuración
document.addEventListener("DOMContentLoaded", () => {
  const auto = document.querySelector("#hs-avatar");
  if (auto) setupAvatarEditButton();
});
