document.addEventListener("DOMContentLoaded", function () {
    const btnGenerar = document.getElementById("btn-generar-plan");
    const resultadoDiv = document.getElementById("resultado-plan");
    const formGuardar = document.getElementById("form-guardar-plan");
    const inputContenido = document.getElementById("input-contenido-plan");
    const flashDiv = document.getElementById("flash");


    if (btnGenerar) {
        btnGenerar.addEventListener("click", async () => {
            const pacienteId = btnGenerar.getAttribute("data-id");
            resultadoDiv.innerText = "Generando plan...";

            try {
                const res = await fetch(`/ia/generar-plan/${pacienteId}`);
                const data = await res.json();

                if (data.plan) {
                    resultadoDiv.innerText = data.plan;
                    inputContenido.value = data.plan;
                    formGuardar.classList.remove("hidden");
                } else {
                    resultadoDiv.innerText = "No se pudo generar el plan.";
                }
            } catch (err) {
                console.error(err);
                resultadoDiv.innerText = "Error al generar el plan.";
            }
        });
    }

    if (formGuardar) {
        formGuardar.addEventListener("submit", async (e) => {
            e.preventDefault();

            const titulo = document.querySelector('input[name="titulo"]').value;
            const contenido = document.querySelector('input[name="contenido"]').value; // ← 🔧 CORREGIDO
            const paciente_id = document.querySelector('input[name="paciente_id"]').value;
            const tipo = "IA";

            const payload = {
                titulo,
                contenido,
                paciente_id,
                tipo
            };

            try {
                const res = await fetch('/planes-alimenticios/guardar', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    flashDiv.innerHTML = `
                <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded">
                    ✅ Plan guardado exitosamente.
                </div>
            `;
                } else {
                    flashDiv.innerHTML = `
                <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
                    ❌ Error al guardar el plan.
                </div>
            `;
                }

                setTimeout(() => {
                    flashDiv.innerHTML = "";
                }, 5000);
            } catch (err) {
                console.error('Error al guardar plan:', err);
                flashDiv.innerHTML = `
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded">
                ❌ Error inesperado al guardar el plan.
            </div>
        `;
                setTimeout(() => {
                    flashDiv.innerHTML = "";
                }, 5000);
            }
        });
    }
});