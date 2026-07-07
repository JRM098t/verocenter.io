/* ==========================================
   VEROCENTER - APPLICATION LOGIC & API INTEGRATION
   ========================================== */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. STATE & PERSISTENCE ---
    // Clean up corrupted saved template if it exists in client's browser local storage
    let savedTemplate = localStorage.getItem('nc_wa_template');
    if (savedTemplate && (savedTemplate.includes('ðŸ') || savedTemplate.includes('Ã­') || savedTemplate.includes('â') || savedTemplate.includes('automÃ¡tico') || savedTemplate.includes('TelÃ©fono'))) {
        localStorage.removeItem('nc_wa_template');
    }

    const state = {
        whatsappNumber: localStorage.getItem('nc_wa_phone') || '56975116975',
        messageTemplate: localStorage.getItem('nc_wa_template') || 
`Hola Verocenter, me gustaría agendar una cita.
Mis datos son:
📌 Nombre: {nombre}
📱 Teléfono: {telefono}
💅 Servicio: {servicio}
📅 Fecha: {fecha}
⏰ Hora: {hora}
💬 Notas: {notas}

Por favor, confírmenme disponibilidad para realizar el pago de reserva.`,
        bookingLogs: JSON.parse(localStorage.getItem('nc_booking_logs')) || [],
        
        // Advanced n8n Webhook settings
        webhookUrl: localStorage.getItem('nc_n8n_url') || '',
        webhookHeaderName: localStorage.getItem('nc_n8n_header_name') || 'Authorization',
        webhookHeaderValue: localStorage.getItem('nc_n8n_header_val') || '',
        sendWebhookEnabled: localStorage.getItem('nc_n8n_enabled') !== 'false'
    };

    // Initialize config fields in Admin panel if they exist (admin.html)
    const configPhoneInput = document.getElementById('configPhone');
    const configTemplateTextarea = document.getElementById('configTemplate');
    const webhookUrlInput = document.getElementById('webhookUrl');
    const webhookHeaderNameInput = document.getElementById('webhookHeaderName');
    const webhookHeaderValueInput = document.getElementById('webhookHeaderValue');
    const toggleSendWebhookInput = document.getElementById('toggleSendWebhook');
    
    if (configPhoneInput) configPhoneInput.value = state.whatsappNumber;
    if (configTemplateTextarea) configTemplateTextarea.value = state.messageTemplate;
    if (webhookUrlInput) webhookUrlInput.value = state.webhookUrl;
    if (webhookHeaderNameInput) webhookHeaderNameInput.value = state.webhookHeaderName;
    if (webhookHeaderValueInput) webhookHeaderValueInput.value = state.webhookHeaderValue;
    if (toggleSendWebhookInput) toggleSendWebhookInput.checked = state.sendWebhookEnabled;

    // --- 2. MOBILE NAVIGATION MENU ---
    const mobileToggle = document.getElementById('mobileToggle');
    const navMenu = document.getElementById('navMenu');
    
    if (mobileToggle && navMenu) {
        mobileToggle.addEventListener('click', () => {
            navMenu.classList.toggle('open');
            const icon = mobileToggle.querySelector('i');
            if (navMenu.classList.contains('open')) {
                icon.className = 'fa-solid fa-xmark';
            } else {
                icon.className = 'fa-solid fa-bars';
            }
        });

        // Close menu on link click
        navMenu.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navMenu.classList.remove('open');
                mobileToggle.querySelector('i').className = 'fa-solid fa-bars';
            });
        });
    }

    // --- 3. SERVICES FILTERING ---
    const filterButtons = document.querySelectorAll('.filter-btn');
    const serviceCards = document.querySelectorAll('.service-card');

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Active button class toggle
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            const category = button.getAttribute('data-filter');

            // Card visibility toggle
            serviceCards.forEach(card => {
                const cardCat = card.getAttribute('data-category');
                if (category === 'all' || cardCat === category || (category === 'adicionales' && cardCat === 'adicionales')) {
                    card.style.display = 'flex';
                    card.style.animation = 'fadeIn 0.4s ease';
                } else {
                    card.style.display = 'none';
                }
            });
        });
    });

    // --- 4. INTERACTIVE BOOKING SELECTION (SUB-LIST BUTTONS & URL PARAMETERS) ---
    const bookingServiceSelect = document.getElementById('bookingService');
    const selectSubServiceButtons = document.querySelectorAll('.btn-select-sub');

    // Click "Reservar" on sub-service list item -> select in form (if on same page)
    selectSubServiceButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const subId = button.getAttribute('data-id');
            if (subId && bookingServiceSelect) {
                bookingServiceSelect.value = subId;
                bookingServiceSelect.dispatchEvent(new Event('change'));
                const bookingSection = document.getElementById('reservas');
                if (bookingSection) {
                    bookingSection.scrollIntoView({ behavior: 'smooth' });
                }
            }
        });
    });

    // Parse URL parameter ?service=... for cross-page redirection pre-selection
    const urlParams = new URLSearchParams(window.location.search);
    const serviceParam = urlParams.get('service');
    if (serviceParam && bookingServiceSelect) {
        bookingServiceSelect.value = serviceParam;
        // Trigger change event to update pricing and durations
        setTimeout(() => {
            bookingServiceSelect.dispatchEvent(new Event('change'));
        }, 150);
    }

    // Min date setup (today's date)
    const bookingDateInput = document.getElementById('bookingDate');
    if (bookingDateInput) {
        const today = new Date().toISOString().split('T')[0];
        bookingDateInput.min = today;
    }

    // --- 5. DYNAMIC SUMMARY BOX & WHATSAPP PREVIEW ---
    const bookingForm = document.getElementById('bookingForm');
    const bookingSummaryBox = document.getElementById('bookingSummaryBox');
    
    const sumService = document.getElementById('sumService');
    const sumDateTime = document.getElementById('sumDateTime');
    const sumDuration = document.getElementById('sumDuration');
    const sumTotal = document.getElementById('sumTotal');
    const whatsappPreviewBubble = document.getElementById('whatsappPreviewBubble');
    
    // Inputs to monitor for real-time preview
    const clientNameInput = document.getElementById('clientName');
    const clientPhoneInput = document.getElementById('clientPhone');
    const bookingDate = document.getElementById('bookingDate');
    const bookingTime = document.getElementById('bookingTime');
    const bookingNotes = document.getElementById('bookingNotes');

    function updateSummaryAndPreview() {
        if (!bookingServiceSelect) return;
        const selectedOption = bookingServiceSelect.options[bookingServiceSelect.selectedIndex];
        
        if (!selectedOption || selectedOption.value === "") {
            if (bookingSummaryBox) bookingSummaryBox.style.display = 'none';
            if (whatsappPreviewBubble) {
                whatsappPreviewBubble.innerText = "(Completa el formulario para ver la vista previa del mensaje automático...)";
            }
            return;
        }

        // 1. Gather data
        const serviceName = selectedOption.text.split(' ($')[0]; // Clean price details
        const servicePrice = parseInt(selectedOption.getAttribute('data-price')).toLocaleString('es-CL');
        const serviceDuration = selectedOption.getAttribute('data-duration');
        
        const dateVal = bookingDate.value ? formatDate(bookingDate.value) : '[Fecha no seleccionada]';
        const timeVal = bookingTime.value || '[Hora no seleccionada]';
        const clientName = clientNameInput.value.trim() || '[Tu Nombre]';
        const clientPhone = clientPhoneInput.value.trim() || '[Tu Teléfono]';
        const notesVal = bookingNotes.value.trim() || 'Sin notas especiales.';

        // 2. Render Summary
        if (sumService) sumService.innerText = serviceName;
        if (sumDateTime) sumDateTime.innerText = `${dateVal} a las ${timeVal}`;
        if (sumDuration) sumDuration.innerText = `${serviceDuration} minutos`;
        if (sumTotal) sumTotal.innerText = `$${servicePrice}`;
        if (bookingSummaryBox) bookingSummaryBox.style.display = 'block';

        // 3. Render WhatsApp Preview
        const variables = {
            nombre: clientName,
            telefono: clientPhone,
            servicio: serviceName,
            fecha: dateVal,
            hora: timeVal,
            notes: notesVal,
            notas: notesVal
        };

        const compiledMessage = compileTemplate(state.messageTemplate, variables);
        if (whatsappPreviewBubble) {
            whatsappPreviewBubble.innerText = compiledMessage;
        }

        return { variables, compiledMessage, serviceName, servicePrice, serviceDuration };
    }

    // Event listeners for dynamic update
    if (bookingServiceSelect) bookingServiceSelect.addEventListener('change', updateSummaryAndPreview);
    if (bookingDate) bookingDate.addEventListener('change', updateSummaryAndPreview);
    if (bookingTime) bookingTime.addEventListener('change', updateSummaryAndPreview);
    if (clientNameInput) clientNameInput.addEventListener('input', updateSummaryAndPreview);
    if (clientPhoneInput) clientPhoneInput.addEventListener('input', updateSummaryAndPreview);
    if (bookingNotes) bookingNotes.addEventListener('input', updateSummaryAndPreview);

    // Helper: format date YYYY-MM-DD to DD/MM/YYYY
    function formatDate(dateString) {
        if (!dateString) return '';
        const parts = dateString.split('-');
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    // Helper: parse custom variables from template
    function compileTemplate(template, vars) {
        let compiled = template;
        compiled = compiled.replace(/{nombre}/g, vars.nombre);
        compiled = compiled.replace(/{telefono}/g, vars.telefono);
        compiled = compiled.replace(/{servicio}/g, vars.servicio);
        compiled = compiled.replace(/{fecha}/g, vars.fecha);
        compiled = compiled.replace(/{hora}/g, vars.hora);
        compiled = compiled.replace(/{notas}/g, vars.notas);
        return compiled;
    }

    // --- 6. AUDIT LOG TABLE RENDERER (admin.html) ---
    const logsTableBody = document.getElementById('logsTableBody');
    const jsonPayloadDisplay = document.getElementById('jsonPayloadDisplay');
    const payloadIndicator = document.getElementById('payloadIndicator');

    function renderLogsTable() {
        if (!logsTableBody) return;
        logsTableBody.innerHTML = '';
        
        if (state.bookingLogs.length === 0) {
            logsTableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No hay transacciones registradas.</td></tr>`;
            return;
        }

        // Render logs in reverse order (most recent first)
        [...state.bookingLogs].reverse().forEach((log, index) => {
            const tr = document.createElement('tr');
            
            // Format time nicely
            const logTime = new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
            const logDate = new Date(log.timestamp).toLocaleDateString([], {day: '2-digit', month:'2-digit'});
            
            // Select status badge class
            let badgeClass = 'local';
            let statusText = log.n8nStatus || 'Pendiente';
            if (statusText.includes('200') || statusText.includes('201') || statusText.includes('success')) {
                badgeClass = 'success';
            } else if (statusText.includes('Error') || statusText.includes('500') || statusText.includes('Fail')) {
                badgeClass = 'error';
            }

            tr.innerHTML = `
                <td><strong>${logDate}</strong> ${logTime}</td>
                <td>${log.client ? log.client.name : 'Cliente'}</td>
                <td>${log.booking ? log.booking.service_name : 'Servicio'}</td>
                <td><span class="status-badge ${badgeClass}">${statusText}</span></td>
            `;

            // Click row to view details in inspector
            tr.addEventListener('click', () => {
                if (jsonPayloadDisplay) {
                    jsonPayloadDisplay.innerText = JSON.stringify(log, null, 2);
                }
                if (payloadIndicator) {
                    payloadIndicator.style.color = badgeClass === 'success' ? '#4af626' : (badgeClass === 'error' ? '#de3434' : '#1d72b8');
                }
            });

            logsTableBody.appendChild(tr);
        });
    }

    // Call immediately in case we are on admin.html
    renderLogsTable();

    function addLogAndTriggern8n(eventPayload) {
        // Save locally
        state.bookingLogs.push(eventPayload);
        localStorage.setItem('nc_booking_logs', JSON.stringify(state.bookingLogs));

        // n8n transmission trigger
        if (state.sendWebhookEnabled && state.webhookUrl) {
            eventPayload.n8nStatus = 'Transmitiendo...';
            renderLogsTable();

            const headers = { 'Content-Type': 'application/json' };
            if (state.webhookHeaderName && state.webhookHeaderValue) {
                headers[state.webhookHeaderName] = state.webhookHeaderValue;
            }

            fetch(state.webhookUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(eventPayload)
            })
            .then(res => {
                eventPayload.n8nStatus = `HTTP ${res.status}`;
                // Save updated status in log
                localStorage.setItem('nc_booking_logs', JSON.stringify(state.bookingLogs));
                renderLogsTable();
                
                // If this is currently active in inspector, update view
                if (jsonPayloadDisplay && jsonPayloadDisplay.innerText.includes(eventPayload.timestamp)) {
                    jsonPayloadDisplay.innerText = JSON.stringify(eventPayload, null, 2);
                }
            })
            .catch(err => {
                eventPayload.n8nStatus = 'Red Error';
                localStorage.setItem('nc_booking_logs', JSON.stringify(state.bookingLogs));
                renderLogsTable();
                console.error("n8n post error:", err);
            });
        } else {
            eventPayload.n8nStatus = 'Redirección WA';
            localStorage.setItem('nc_booking_logs', JSON.stringify(state.bookingLogs));
            renderLogsTable();
        }
    }

    // --- 7. FORM SUBMISSION & WHATSAPP REDIRECT ---
    if (bookingForm) {
        bookingForm.addEventListener('submit', (e) => {
            e.preventDefault();

            const previewData = updateSummaryAndPreview();
            if (!previewData) return;

            // Create webhook event payload
            const eventPayload = {
                event: "booking_requested",
                timestamp: new Date().toISOString(),
                client: {
                    name: previewData.variables.nombre,
                    phone: previewData.variables.telefono
                },
                booking: {
                    service_id: bookingServiceSelect.value,
                    service_name: previewData.serviceName,
                    price: previewData.servicePrice,
                    duration_minutes: previewData.serviceDuration,
                    date: bookingDate.value,
                    time: bookingTime.value,
                    notes: bookingNotes.value.trim()
                },
                automation: {
                    recipient_phone: state.whatsappNumber,
                    channel: "whatsapp_api_direct",
                    message_payload: previewData.compiledMessage
                }
            };

            // Log event in real-time JSON display panel if present
            if (jsonPayloadDisplay) {
                jsonPayloadDisplay.innerText = JSON.stringify(eventPayload, null, 2);
            }

            // Save log and post to n8n webhook
            addLogAndTriggern8n(eventPayload);

            // Generate WhatsApp Link & redirect
            const encodedText = encodeURIComponent(previewData.compiledMessage);
            const waUrl = `https://wa.me/${state.whatsappNumber}?text=${encodedText}`;

            // Open WhatsApp click-to-chat
            window.open(waUrl, '_blank');
        });
    }

    // --- 8. ADMIN / AUTOMATION CONFIG LOGIC (admin.html elements) ---
    const savePhoneBtn = document.getElementById('savePhoneBtn');
    const saveTemplateBtn = document.getElementById('saveTemplateBtn');
    const clearLogsBtn = document.getElementById('clearLogsBtn');
    const webhookAlert = document.getElementById('webhookAlert');
    const webhookAlertMsg = document.getElementById('webhookAlertMsg');
    
    // Advanced webhook DOM elements
    const saveWebhookSettingsBtn = document.getElementById('saveWebhookSettingsBtn');
    const testWebhookBtn = document.getElementById('testWebhookBtn');

    function showAdminNotification(message, type = 'success') {
        if (webhookAlert && webhookAlertMsg) {
            webhookAlert.style.display = 'flex';
            webhookAlertMsg.innerText = message;
            if (type === 'success') {
                webhookAlert.style.backgroundColor = '#e8f4fd';
                webhookAlert.style.color = '#1d72b8';
                webhookAlert.style.borderColor = '#d2e7f7';
            } else {
                webhookAlert.style.backgroundColor = '#fdf2f2';
                webhookAlert.style.color = '#de3434';
                webhookAlert.style.borderColor = '#fde2e2';
            }
            setTimeout(() => {
                webhookAlert.style.display = 'none';
            }, 4000);
        }
    }

    if (savePhoneBtn && configPhoneInput) {
        savePhoneBtn.addEventListener('click', () => {
            const rawPhone = configPhoneInput.value.replace(/[^0-9]/g, '');
            if (rawPhone.length < 8) {
                showAdminNotification('Número de WhatsApp inválido. Digite sólo números con código de país.', 'error');
                return;
            }
            state.whatsappNumber = rawPhone;
            localStorage.setItem('nc_wa_phone', rawPhone);
            showAdminNotification('Número de WhatsApp guardado correctamente.');
            updateSummaryAndPreview();
        });
    }

    if (saveTemplateBtn && configTemplateTextarea) {
        saveTemplateBtn.addEventListener('click', () => {
            const template = configTemplateTextarea.value.trim();
            if (template === "") {
                showAdminNotification('La plantilla no puede estar vacía.', 'error');
                return;
            }
            state.messageTemplate = template;
            localStorage.setItem('nc_wa_template', template);
            showAdminNotification('Plantilla de mensaje guardada.');
            updateSummaryAndPreview();
        });
    }

    // Save n8n settings
    if (saveWebhookSettingsBtn && webhookUrlInput) {
        saveWebhookSettingsBtn.addEventListener('click', () => {
            state.webhookUrl = webhookUrlInput.value.trim();
            state.webhookHeaderName = webhookHeaderNameInput.value.trim();
            state.webhookHeaderValue = webhookHeaderValueInput.value.trim();
            state.sendWebhookEnabled = toggleSendWebhookInput.checked;

            localStorage.setItem('nc_n8n_url', state.webhookUrl);
            localStorage.setItem('nc_n8n_header_name', state.webhookHeaderName);
            localStorage.setItem('nc_n8n_header_val', state.webhookHeaderValue);
            localStorage.setItem('nc_n8n_enabled', state.sendWebhookEnabled);

            showAdminNotification('Configuración de n8n guardada correctamente.');
        });
    }

    // Test n8n webhook connection
    if (testWebhookBtn && webhookUrlInput) {
        testWebhookBtn.addEventListener('click', () => {
            const testUrl = webhookUrlInput.value.trim() || state.webhookUrl;
            if (!testUrl) {
                showAdminNotification('Especifica una URL de webhook primero.', 'error');
                return;
            }

            showAdminNotification('Probando conexión con n8n...');

            const testPayload = {
                event: "connection_test",
                timestamp: new Date().toISOString(),
                message: "Probando la conexión de webhook desde el panel de control de Verocenter.",
                source: "Verocenter Admin Dashboard"
            };

            const headers = { 'Content-Type': 'application/json' };
            const authName = webhookHeaderNameInput.value.trim();
            const authVal = webhookHeaderValueInput.value.trim();
            if (authName && authVal) {
                headers[authName] = authVal;
            }

            fetch(testUrl, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(testPayload)
            })
            .then(res => {
                if (res.ok) {
                    showAdminNotification(`Conexión exitosa. HTTP ${res.status} OK.`);
                } else {
                    showAdminNotification(`Error en respuesta. HTTP ${res.status}. Checkea n8n.`, 'error');
                }
            })
            .catch(err => {
                showAdminNotification('Fallo de red al conectar con n8n. ¿La URL es pública?', 'error');
                console.error("Test trigger error:", err);
            });
        });
    }

    if (clearLogsBtn) {
        clearLogsBtn.addEventListener('click', () => {
            state.bookingLogs = [];
            localStorage.removeItem('nc_booking_logs');
            if (jsonPayloadDisplay) {
                jsonPayloadDisplay.innerText = JSON.stringify({
                    status: "cleared",
                    message: "Historial de logs limpio. Completa una reserva para registrar nuevos eventos."
                }, null, 2);
            }
            renderLogsTable();
            showAdminNotification('Historial de logs restablecido.');
        });
    }

    // --- 9. WEBHOOK SIMULATION BUTTONS ---
    const btnSimulateSuccess = document.getElementById('btnSimulateSuccess');
    const btnSimulateReminder = document.getElementById('btnSimulateReminder');

    if (btnSimulateSuccess) {
        btnSimulateSuccess.addEventListener('click', () => {
            const mockPayload = {
                event: "booking_confirmed_webhook",
                status: "success",
                provider: "Twilio/WhatsApp-Cloud-API",
                recipient: `+${state.whatsappNumber}`,
                delivered_at: new Date().toISOString(),
                booking_details: {
                    reference_id: "VC-" + Math.floor(1000 + Math.random() * 9000),
                    client_name: "María Constanza",
                    service: "Acrílico - Largo M",
                    price_clp: 27000,
                    date_time: "2026-07-05T15:00:00Z"
                }
            };
            if (jsonPayloadDisplay) {
                jsonPayloadDisplay.innerText = JSON.stringify(mockPayload, null, 2);
            }
            // Trigger n8n event
            addLogAndTriggern8n(mockPayload);
            showAdminNotification('Webhook Simulado: Cita confirmada enviada exitosamente.');
        });
    }

    if (btnSimulateReminder) {
        btnSimulateReminder.addEventListener('click', () => {
            const mockPayload = {
                event: "booking_reminder_webhook",
                status: "sent",
                provider: "Meta-WhatsApp-Business",
                scheduled_for: new Date(Date.now() + 86400000).toISOString(),
                payload: {
                    template_name: "verocenter_reminder",
                    language: "es",
                    components: [
                        {
                            type: "body",
                            parameters: [
                                { type: "text", text: "María Constanza" },
                                { type: "text", text: "Mañana a las 15:00 hrs" }
                            ]
                        }
                    ]
                }
            };
            if (jsonPayloadDisplay) {
                jsonPayloadDisplay.innerText = JSON.stringify(mockPayload, null, 2);
            }
            // Trigger n8n event
            addLogAndTriggern8n(mockPayload);
            showAdminNotification('Webhook Simulado: Recordatorio de cita programado y enviado.');
        });
    }

    // --- 10. DYNAMIC NEXT AVAILABLE DATE CALCULATION ---
    const nextAvailableDateSpan = document.getElementById('nextAvailableDate');
    if (nextAvailableDateSpan) {
        const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        
        let targetDate = new Date();
        // If it's late (after 6 PM), propose tomorrow
        if (targetDate.getHours() >= 18) {
            targetDate.setDate(targetDate.getDate() + 1);
        }
        // If Sunday, propose Monday
        if (targetDate.getDay() === 0) {
            targetDate.setDate(targetDate.getDate() + 1);
        }

        const dayName = days[targetDate.getDay()];
        const dayNum = targetDate.getDate();
        const monthName = months[targetDate.getMonth()];
        const proposedTime = targetDate.getHours() < 12 ? '12:00 hrs' : '16:30 hrs';

        nextAvailableDateSpan.innerHTML = `<i class="fa-regular fa-calendar-check"></i> ${dayName} ${dayNum} de ${monthName}, ${proposedTime}`;
    }

    // --- 11. 3D SCROLL ANIMATION OBSERVER ---
    const scroll3DItems = document.querySelectorAll('.scroll-3d');
    
    if (scroll3DItems.length > 0) {
        const observerOptions = {
            root: null, // screen viewport
            rootMargin: '0px',
            threshold: 0.15 // trigger when 15% is visible
        };

        const observer = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('in-view');
                    // Unobserve after showing for performance
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);

        scroll3DItems.forEach(item => {
            observer.observe(item);
        });
    }

});
