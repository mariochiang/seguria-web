(function () {
    const config = window.CHATBOT_CONFIG || {};
    const functionUrl = config.functionUrl || "";

    const launcher = document.querySelector(".chat-launcher");
    const widget = document.querySelector(".chat-widget");
    const closeButton = document.querySelector(".icon-button");
    const messages = document.querySelector(".chat-messages");
    const form = document.querySelector(".chat-form");
    const input = document.querySelector("#chat-input");

    let rutIdentificado = "";
    let clienteIdentificado = "";
    let productos = [];
    let started = false;

    function addMessage(text, type) {
        const item = document.createElement("div");
        item.className = `message ${type}`;
        item.textContent = text;
        messages.appendChild(item);
        messages.scrollTop = messages.scrollHeight;
    }

    function openChat() {
        widget.hidden = false;
        launcher.hidden = true;

        if (!started) {
            addMessage(
                "Hola, soy el asistente virtual de SegurIA. Para comenzar, indícame tu RUT.",
                "bot"
            );
            started = true;
        }

        input.focus();
    }

    function closeChat() {
        widget.hidden = true;
        launcher.hidden = false;
    }

    function looksLikeRut(value) {
        return /^[0-9.\-kK]{7,14}$/.test(value.trim());
    }

    function nextLocalReply(message) {
        const text = message.toLowerCase();

        if (text.includes("reclamo") || text.includes("problema")) {
            return "Puedo orientarte con un reclamo. En la siguiente versión registraremos el caso automáticamente; por ahora te recomiendo indicar el producto y una breve descripción del problema.";
        }

        if (text.includes("siniestro") || text.includes("choque")) {
            return "Entiendo. Para un siniestro necesitaremos fecha, lugar, producto asociado y una descripción breve. Pronto conectaremos este flujo al registro de casos.";
        }

        if (text.includes("cancelar") || text.includes("baja")) {
            return "Puedo ayudarte con esa solicitud. Antes de avanzar, un ejecutivo debería revisar alternativas según tus productos vigentes.";
        }

        if (productos.length > 0) {
            return `Tengo registrado que tus productos activos son: ${productos.join(", ")}. Puedes contarme qué necesitas y te orientaré con el siguiente paso.`;
        }

        return "Cuéntame un poco más sobre lo que necesitas y te orientaré con el siguiente paso.";
    }

    async function identifyCustomer(rut, message) {
        if (!functionUrl || functionUrl.includes("TU_FUNCTION")) {
            addMessage(
                "Falta configurar la URL de la Azure Function en config.js.",
                "bot error"
            );
            return;
        }

        addMessage("Consultando tus datos...", "bot");

        try {
            const response = await fetch(functionUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    rut,
                    mensaje: message || "hola"
                })
            });

            const raw = await response.text();
            let data = {};

            try {
                data = JSON.parse(raw);
            } catch (error) {
                data = { respuesta: raw };
            }

            if (!response.ok) {
                addMessage(data.respuesta || "No pude completar la consulta.", "bot error");
                return;
            }

            rutIdentificado = data.rut || rut;
            clienteIdentificado = data.cliente || "";
            productos = Array.isArray(data.productos) ? data.productos : [];

            addMessage(data.respuesta || "Cliente identificado correctamente.", "bot");
        } catch (error) {
            addMessage(
                "No pude conectar con el servicio. Revisa CORS o la URL de la Function.",
                "bot error"
            );
        }
    }

    launcher.addEventListener("click", openChat);
    closeButton.addEventListener("click", closeChat);

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const value = input.value.trim();

        if (!value) {
            return;
        }

        addMessage(value, "user");
        input.value = "";

        if (!rutIdentificado) {
            if (!looksLikeRut(value)) {
                addMessage("Para identificarte necesito que me indiques tu RUT.", "bot");
                return;
            }

            await identifyCustomer(value, "hola");
            return;
        }

        const reply = nextLocalReply(value);
        const namePrefix = clienteIdentificado ? `${clienteIdentificado}, ` : "";
        addMessage(`${namePrefix}${reply}`, "bot");
    });
})();
