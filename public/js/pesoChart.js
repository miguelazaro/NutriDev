document.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("pesoChart");
    if (!canvas) return;

    const fechas = JSON.parse(canvas.dataset.fechas || "[]");
    const pesos  = JSON.parse(canvas.dataset.pesos  || "[]");

    if (!fechas.length || !pesos.length) return;

    new Chart(canvas, {
        type: "line",
        data: {
            labels: fechas,
            datasets: [{
                label: "Peso (kg)",
                data: pesos,
                borderColor: "#059669",
                backgroundColor: "rgba(5,150,105,0.3)",
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            }
        }
    });
});
