// public/js/iaPlan.js
(function () {
  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-generar-plan');
    const resultEl = document.getElementById('resultado-plan');
    const formGuardar = document.getElementById('form-guardar-plan'); // compatibilidad
    const inputContenido = document.getElementById('input-contenido-plan');
    const flash = document.getElementById('flash');

    const showFlash = (msg, type = 'info') => {
      if (!flash) return;
      const colors = {
        success: 'bg-emerald-50 text-emerald-800 border-emerald-300',
        error: 'bg-red-50 text-red-800 border-red-300',
        info: 'bg-blue-50 text-blue-800 border-blue-300'
      };
      flash.innerHTML = `<div class="mt-2 border p-3 rounded ${colors[type] || colors.info}">${msg}</div>`;
    };

    const setLoading = (loading) => {
      if (!btn) return;
      if (loading) {
        btn.dataset._origText = btn.textContent;
        btn.textContent = 'Generando…';
        btn.disabled = true;
      } else {
        btn.textContent = btn.dataset._origText || 'Generar Plan IA';
        btn.disabled = false;
      }
    };

    if (!btn) return;

    btn.addEventListener('click', async () => {
      const pacienteId = btn.getAttribute('data-id');
      if (!pacienteId) {
        showFlash('No se encontró el ID del paciente.', 'error');
        return;
      }

      showFlash('Solicitando plan a la IA, puede tardar unos segundos…', 'info');
      resultEl.textContent = '';
      formGuardar?.classList.add('hidden');
      setLoading(true);

      try {
        const resp = await fetch(`/ia/generar-plan/${encodeURIComponent(pacienteId)}?return=json`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
          credentials: 'same-origin'
        });

        const contentType = resp.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
          const text = await resp.text();
          console.warn('Respuesta no JSON:', text);
          throw new Error('La sesión pudo haber expirado. Inicia sesión e inténtalo de nuevo.');
        }

        const data = await resp.json();

        // Soporta NUEVO { ok, planId, contenido } y VIEJO { plan }
        const okNew = data && data.ok && data.contenido;
        const okOld = data && data.plan;

        if (!resp.ok || (!okNew && !okOld)) {
          throw new Error(data?.error || 'No se pudo generar el plan con IA.');
        }

        const md = okNew ? data.contenido : data.plan;
        resultEl.textContent = md;
        if (inputContenido) inputContenido.value = md;

        if (okNew && data.planId) {
          // Ya quedó guardado en el backend
          showFlash(
            `<a href="/planes-alimenticios/${data.planId}" class="inline-block mt-3 px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700">Ver plan guardado</a>`,
            'success'
          );
        } else {
          // Flujo antiguo: mostrar botón para guardar manualmente
          formGuardar?.classList.remove('hidden');
          showFlash('Plan generado. Puedes guardarlo con el botón verde.', 'success');
        }
      } catch (err) {
        console.error('Error IA:', err);
        showFlash(err.message || 'Ocurrió un error al generar el plan.', 'error');
      } finally {
        setLoading(false);
      }
    });
  });
})();
