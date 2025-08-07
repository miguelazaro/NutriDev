document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-generar-plan');
    const resultado = document.getElementById('resultado-plan');

    if (!btn || !resultado) return;

    btn.addEventListener('click', async () => {
        const pacienteId = btn.getAttribute('data-id');

        resultado.textContent = 'Generando plan alimenticio...';

        try {
            const res = await fetch(`/ia/generar-plan/${pacienteId}`);
            const data = await res.json();

            if (data.plan) {
                resultado.textContent = data.plan;
            } else {
                resultado.textContent = 'No se pudo generar el plan alimenticio.';
            }
        } catch (err) {
            console.error('Error:', err);
            resultado.textContent = 'Ocurrió un error al generar el plan IA.';
        }
    });
});
