(function () {
    const config = window.CHATBOT_CONFIG || {};
    const functionUrl = config.functionUrl || "";
    const productosUrl = config.productosUrl || "";

    const launcher = document.querySelector(".chat-launcher");
    const widget = document.querySelector(".chat-widget");
    const closeButton = document.querySelector(".icon-button");
    const messages = document.querySelector(".chat-messages");
    const form = document.querySelector(".chat-form");
    const input = document.querySelector("#chat-input");

    const quoteProducts = document.querySelector("#quote-products");
    const quoteFeedback = document.querySelector("#quote-feedback");
    const cotizarLink = document.querySelector("#cotizar-link");

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

    function showQuoteFeedback(text, isError) {
        if (!quoteFeedback) {
            return;
        }

        quoteFeedback.hidden = false;
        quoteFeedback.textContent = text;
        quoteFeedback.className = isError
            ? "quote-feedback quote-feedback-error"
            : "quote-feedback quote-feedback-info";
    }

    function clearQuoteFeedback() {
        if (!quoteFeedback) {
            return;
        }

        quoteFeedback.hidden = true;
        quoteFeedback.textContent = "";
        quoteFeedback.className = "quote-feedback";
    }

    function renderProductos(productosDisponibles) {
        if (!quoteProducts) {
            return;
        }

        if (!Array.isArray(productosDisponibles) || productosDisponibles.length === 0) {
            quoteProducts.innerHTML = "";
            showQuoteFeedback("No hay productos disponibles para cotizar en este momento.", true);
            return;
        }

        clearQuoteFeedback();

        quoteProducts.innerHTML = productosDisponibles
            .map(function (producto) {
                const prima = Number(producto.prima_base || 0).toLocaleString("es-CL");

                return `
                    <article class="quote-card">
                        <div class="quote-card-top">
                            <h3>${producto.nombre}</h3>
                            <span>Prima base referencial</span>
                        </div>
                        <p class="quote-price">$${prima}</p>
                        <button type="button" class="quote-action" data-producto-id="${producto.producto_id}">
                            Cotizar este producto
                        </button>
                    </article>
                `;
            })
            .join("");

        const buttons = quoteProducts.querySelectorAll(".quote-action");

        buttons.forEach(function (button) {
            button.addEventListener("click", function () {
                const card = button.closest(".quote-card");
                const nombre = card ? card.querySelector("h3").textContent : "este producto";

                showQuoteFeedback(
                    `Seleccionaste ${nombre}. El siguiente paso será construir el formulario de cotización y contratación.`,
                    false
                );
            });
        });
    }

    async function cargarProductos() {
        if (!productosUrl || productosUrl.includes("TU_FUNCTION")) {
            showQuoteFeedback(
                "Falta configurar la URL de productos en config.js.",
                true
            );
            return;
        }

        showQuoteFeedback("Cargando productos disponibles...", false);

        try {
            const response = await fetch(productosUrl, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json"
                }
            });

            const raw = await response.text();
            let data = {};

            try {
                data = JSON.parse(raw);
            } catch (error) {
                data = {};
            }

            if (!response.ok) {
                showQuoteFeedback(
                    data.detail || "No pude cargar los productos disponibles.",
                    true
                );
                return;
            }

            renderProductos(data.productos || []);
        } catch (error) {
            showQuoteFeedback(
                "No pude conectar con el servicio de productos.",
                true
            );
        }
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
    cargarProductos();

    if (cotizarLink) {
        cotizarLink.addEventListener("click", function () {
            setTimeout(function () {
                cargarProductos();
            }, 150);
        });
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

            await identifyCustomer(value);
            return;
        }

        await continueConversation(value);
    });
})();
