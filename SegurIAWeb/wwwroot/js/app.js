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
        return item;
    }

    function resetConversation(options) {
        const settings = options || {};
        const keepOpen = settings.keepOpen !== false;
        const showWelcome = settings.showWelcome !== false;

        rutIdentificado = "";
        clienteIdentificado = "";
        productos = [];
        started = false;
        messages.innerHTML = "";

        if (keepOpen) {
            widget.hidden = false;
            launcher.hidden = true;
        }

        if (showWelcome) {
            addMessage(
                "Hola, soy el asistente virtual de SegurIA. Para comenzar, indícame tu RUT.",
                "bot"
            );
            started = true;
        }

        input.value = "";
        input.focus();
    }

    function ensureResetButton() {
        if (!closeButton || !closeButton.parentElement) {
            return;
        }

        const header = closeButton.parentElement;
        const resetButton = document.createElement("button");
        resetButton.type = "button";
        resetButton.className = "chat-reset-button";
        resetButton.textContent = "Nueva consulta";
        resetButton.style.marginRight = "0.5rem";

        resetButton.addEventListener("click", function () {
            resetConversation({
                keepOpen: true,
                showWelcome: true
            });
        });

        header.insertBefore(resetButton, closeButton);
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

    async function enviarMensajeBackend(rut, mensaje, loadingText) {
        if (!functionUrl || functionUrl.includes("TU_FUNCTION")) {
            addMessage(
                "Falta configurar la URL de la Azure Function en config.js.",
                "bot error"
            );
            return null;
        }

        const loadingMessage = addMessage(loadingText, "bot");

        try {
            const response = await fetch(functionUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    rut,
                    mensaje
                })
            });

            loadingMessage.remove();

            const raw = await response.text();
            let data = {};

            try {
                data = JSON.parse(raw);
            } catch (error) {
                data = { respuesta: raw };
            }

            if (!response.ok) {
                addMessage(
                    data.respuesta || data.detail || "No pude completar la consulta.",
                    "bot error"
                );
                return null;
            }

            if (data.cliente_identificado === true) {
                rutIdentificado = data.rut || rut;
                clienteIdentificado = data.cliente || "";
                productos = Array.isArray(data.productos) ? data.productos : [];
            }

            return data;
        } catch (error) {
            loadingMessage.remove();
            addMessage(
                "No pude conectar con el servicio. Revisa CORS o la URL de la Function.",
                "bot error"
            );
            return null;
        }
    }

    async function identifyCustomer(rut) {
        const data = await enviarMensajeBackend(rut, "hola", "Consultando tus datos...");

        if (!data) {
            return;
        }

        addMessage(data.respuesta || "Cliente identificado correctamente.", "bot");
    }

    async function continueConversation(message) {
        const data = await enviarMensajeBackend(
            rutIdentificado,
            message,
            "Procesando tu consulta..."
        );

        if (!data) {
            return;
        }

        addMessage(data.respuesta || "No recibi una respuesta del servicio.", "bot");
    }

    ensureResetButton();

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

            await identifyCustomer(value);
            return;
        }

        await continueConversation(value);
    });
})();
