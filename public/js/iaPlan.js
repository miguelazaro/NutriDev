// public/js/iaPlan.js
document.addEventListener('DOMContentLoaded', () => {
    const tabPlanes = document.querySelector('[data-tab="planes"]');
    const contenedor = document.querySelector('#planes');
    const pacienteId = window.location.pathname.split('/').pop(); // asume ruta /pacientes/:id

    if (!tabPlanes || !contenedor || !pacienteId) return;

    tabPlanes.addEventListener('click', async () => {
        if (contenedor.dataset.loaded === 'true') return; // evitar recarga innecesaria
        const loading = document.createElement('p');
        loading.textContent = 'Generando plan alimenticio con IA...';
        loading.className = 'text-sm text-gray-500 italic';
        contenedor.appendChild(loading);

        try {
            const res = await fetch(`/ia/plan/${pacienteId}`);
            const data = await res.json();

            loading.remove();

            if (data.plan) {
                const pre = document.createElement('pre');
                pre.className = 'whitespace-pre-wrap bg-indigo-50 border border-indigo-200 p-4 rounded-lg text-sm text-gray-800';
                pre.textContent = data.plan;
                contenedor.appendChild(pre);
                contenedor.dataset.loaded = 'true';
            } else {
                contenedor.innerHTML += `<p class="text-red-500 text-sm mt-2">${data.error || 'No se pudo generar el plan.'}</p>`;
            }
        } catch (err) {
            loading.remove();
            contenedor.innerHTML += `<p class="text-red-500 text-sm mt-2">Error al conectar con la IA</p>`;
            console.error(err);
        }
    });
});
