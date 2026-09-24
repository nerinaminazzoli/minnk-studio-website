/**
 * MINNK Studio — Order Form Handler
 * Handles form submission for Your Photos, Collections, and For Business
 */

(function() {
    'use strict';

    // Find all order forms with data-minnk-order attribute
    const forms = document.querySelectorAll('form[data-minnk-order]');

    forms.forEach(form => {
        const source = form.getAttribute('data-source');
        const sendMode = form.getAttribute('data-send-mode');

        if (!source || !sendMode) {
            console.error('MINNK Order Form: missing data-source or data-send-mode attribute');
            return;
        }

        // Disable browser's automatic validation to handle custom validation first
        form.noValidate = true;

        // Handle contact method radio buttons
        const contactMethodRadios = form.querySelectorAll('input[name="contact_method"]');
        const phoneFieldContainer = form.querySelector('[data-phone-field]');
        const phoneInput = phoneFieldContainer ? phoneFieldContainer.querySelector('input[type="tel"]') : null;

        if (contactMethodRadios.length > 0 && phoneFieldContainer && phoneInput) {
            contactMethodRadios.forEach(radio => {
                radio.addEventListener('change', function() {
                    if (this.value === 'whatsapp') {
                        // Show phone field and make it required
                        phoneFieldContainer.style.display = 'block';
                        phoneInput.required = true;
                    } else if (this.value === 'email') {
                        // Hide phone field, remove required, and clear value
                        phoneFieldContainer.style.display = 'none';
                        phoneInput.required = false;
                        phoneInput.value = '';
                    }
                });
            });

            // Set initial state
            const checkedRadio = form.querySelector('input[name="contact_method"]:checked');
            if (checkedRadio) {
                const event = new Event('change');
                checkedRadio.dispatchEvent(event);
            }
        }

        // Handle form submission
        form.addEventListener('submit', async function(event) {
            event.preventDefault();

            // Custom validation: check if contact_method is selected
            const contactMethodChecked = form.querySelector('input[name="contact_method"]:checked');
            if (!contactMethodChecked) {
                showContactMethodError(form);
                return;
            }

            // Validate with native browser validation
            if (!form.checkValidity()) {
                form.reportValidity();
                return;
            }

            // Get submit button
            const submitButton = form.querySelector('button[type="submit"]') ||
                               document.querySelector(`button[form="${form.id}"]`);

            if (!submitButton) {
                console.error('MINNK Order Form: submit button not found');
                return;
            }

            // Disable button and change text
            const originalButtonText = submitButton.textContent;
            submitButton.disabled = true;
            submitButton.textContent = 'Sending...';

            // Generate order code: MNK-MMDD-NN
            const now = new Date();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const random = String(Math.floor(Math.random() * 100)).padStart(2, '0');
            const orderCode = `MNK-${month}${day}-${random}`;

            // Prepare form data
            const formData = new FormData(form);
            formData.append('order_code', orderCode);
            formData.append('source', source);
            formData.append('_subject', `New request ${orderCode}`);

            try {
                // Send to Formspree
                const response = await fetch('https://formspree.io/f/xeaokpjl', {
                    method: 'POST',
                    body: formData,
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                if (response.ok) {
                    // Success: show confirmation
                    showConfirmation(form, orderCode, sendMode, formData);
                } else {
                    // Error: show error message
                    showError(form, submitButton, originalButtonText);
                }
            } catch (error) {
                // Network error: show error message
                console.error('MINNK Order Form: submission error', error);
                showError(form, submitButton, originalButtonText);
            }
        });
    });

    /**
     * Show confirmation message after successful submission
     */
    function showConfirmation(form, orderCode, sendMode, formData) {
        // Get the selected contact method
        const contactMethod = formData.get('contact_method') || 'email';

        // Build confirmation HTML with appropriate text based on send-mode
        const confirmationText = sendMode === 'none'
            ? "We'll review it and confirm before any payment."
            : "We'll review it and send you a preview before any payment.";

        let confirmationHTML = `
            <div class="minnk-confirmation">
                <h2 class="minnk-confirmation-title">Request received</h2>
                <div class="minnk-confirmation-code">${orderCode}</div>
                <p class="minnk-confirmation-text">${confirmationText}</p>
        `;

        // Add action button based on send-mode and contact method
        if (sendMode === 'photos' || sendMode === 'logo') {
            const assetType = sendMode === 'photos' ? 'photos' : 'logo';
            const assetTypeCapitalized = assetType.charAt(0).toUpperCase() + assetType.slice(1);

            if (contactMethod === 'whatsapp') {
                const whatsappMessage = sendMode === 'photos'
                    ? `Hi MINNK! My request is ${orderCode}. Here are my photos:`
                    : `Hi MINNK! My request is ${orderCode}. Here is my logo:`;
                const whatsappURL = `https://wa.me/4591118494?text=${encodeURIComponent(whatsappMessage)}`;

                confirmationHTML += `
                    <a href="${whatsappURL}" class="minnk-confirmation-button" target="_blank">
                        Send your ${assetType} on WhatsApp
                    </a>
                `;
            } else {
                // email
                const emailSubject = sendMode === 'photos'
                    ? `Photos for request ${orderCode}`
                    : `Logo for request ${orderCode}`;
                const mailtoURL = `mailto:hello@minnkstudio.com?subject=${encodeURIComponent(emailSubject)}`;

                confirmationHTML += `
                    <a href="${mailtoURL}" class="minnk-confirmation-button">
                        Send your ${assetType} by email
                    </a>
                    <p class="minnk-confirmation-note">Or write to hello@minnkstudio.com</p>
                `;
            }
        } else {
            // sendMode === 'none'
            confirmationHTML += `
                <p class="minnk-confirmation-note">We'll contact you to confirm.</p>
            `;
        }

        confirmationHTML += `</div>`;

        // Replace form with confirmation
        const formParent = form.parentElement;
        formParent.innerHTML = confirmationHTML;

        // Find the container (modal or page section) that contains this form
        const modalContent = form.closest('.modal-content');
        const container = modalContent || document;

        // Hide elements with data-hide-on-success only within this container
        const elementsToHide = container.querySelectorAll('[data-hide-on-success]');
        elementsToHide.forEach(element => {
            element.style.display = 'none';
        });

        // Smooth scroll to confirmation
        const confirmation = formParent.querySelector('.minnk-confirmation');
        if (confirmation) {
            if (modalContent) {
                // Inside a modal: scroll within the modal
                modalContent.scrollTo({
                    top: confirmation.offsetTop - 20,
                    behavior: 'smooth'
                });
            } else {
                // On a regular page: scroll the page
                confirmation.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }

    /**
     * Show error message after failed submission
     */
    function showError(form, submitButton, originalButtonText) {
        // Re-enable button
        submitButton.disabled = false;
        submitButton.textContent = originalButtonText;

        // Check if error message already exists
        let errorMessage = form.querySelector('.minnk-error-message');

        if (!errorMessage) {
            errorMessage = document.createElement('div');
            errorMessage.className = 'minnk-error-message';
            errorMessage.innerHTML = `
                Something went wrong. Please try again or
                <a href="https://wa.me/4591118494" target="_blank">message us on WhatsApp</a>.
            `;

            // Insert before submit button
            if (submitButton.form === form) {
                submitButton.parentElement.insertBefore(errorMessage, submitButton);
            } else {
                // External button, insert at end of form
                form.appendChild(errorMessage);
            }
        }
    }

    /**
     * Show contact method error
     */
    function showContactMethodError(form) {
        const radioGroup = form.querySelector('.radio-group');
        if (!radioGroup) return;

        // Add error class to radio options
        const radioOptions = form.querySelectorAll('.radio-option');
        radioOptions.forEach(option => {
            option.classList.add('radio-option-error');
        });

        // Check if error message already exists
        let errorMessage = radioGroup.parentElement.querySelector('.contact-method-error');

        if (!errorMessage) {
            errorMessage = document.createElement('div');
            errorMessage.className = 'contact-method-error';
            errorMessage.textContent = 'Please choose WhatsApp or Email.';

            // Insert after radio-group
            radioGroup.parentElement.insertBefore(errorMessage, radioGroup.nextSibling);
        }

        // Scroll to make the error visible
        const modalContent = form.closest('.modal-content');
        if (modalContent) {
            // Inside a modal: scroll within the modal to the radio group
            modalContent.scrollTo({
                top: radioGroup.parentElement.offsetTop - 40,
                behavior: 'smooth'
            });
        } else {
            // On a regular page: scroll to the step section
            const stepSection = form.closest('.step-section');
            if (stepSection) {
                stepSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        // Add change listeners to radios to clear error
        const radios = form.querySelectorAll('input[name="contact_method"]');
        radios.forEach(radio => {
            radio.addEventListener('change', function clearError() {
                // Remove error class
                radioOptions.forEach(option => {
                    option.classList.remove('radio-option-error');
                });

                // Remove error message
                const error = radioGroup.parentElement.querySelector('.contact-method-error');
                if (error) {
                    error.remove();
                }

                // Remove this listener
                radio.removeEventListener('change', clearError);
            }, { once: true });
        });
    }
})();
