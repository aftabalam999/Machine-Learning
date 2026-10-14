/**
 * House Rent Prediction Application - Frontend Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // Form and Element references
    const form = document.getElementById('prediction-form');
    const submitBtn = document.getElementById('submit-btn');
    const btnSpinner = document.getElementById('btn-spinner');
    const resetBtn = document.getElementById('reset-btn');

    // Inputs
    const citySelect = document.getElementById('city-select');
    const propertyTypeSelect = document.getElementById('property-type-select');
    const furnishingSelect = document.getElementById('furnishing-select');
    const floorSelect = document.getElementById('floor-select');

    const bhkInput = document.getElementById('bhk-input');
    const bhkDisplay = document.getElementById('bhk-display');
    const bathroomsInput = document.getElementById('bathrooms-input');
    const bathDisplay = document.getElementById('bath-display');

    const sizeInput = document.getElementById('size-input');
    const sizeSlider = document.getElementById('size-slider');
    const sizeTags = document.querySelectorAll('.size-tag');

    const ageSlider = document.getElementById('property-age-slider');
    const ageInput = document.getElementById('property-age-input');
    const ageDisplay = document.getElementById('age-display');

    // Result displays
    const predictedRentVal = document.getElementById('predicted-rent-val');
    const annualRentVal = document.getElementById('annual-rent-val');
    const sqftRentVal = document.getElementById('sqft-rent-val');
    const predictionBox = document.querySelector('.prediction-box');

    // Chips
    const chipCity = document.getElementById('chip-city');
    const chipBhk = document.getElementById('chip-bhk');
    const chipSize = document.getElementById('chip-size');
    const chipBaths = document.getElementById('chip-baths');
    const chipType = document.getElementById('chip-type');
    const chipFurnishing = document.getElementById('chip-furnishing');
    const chipFloor = document.getElementById('chip-floor');
    const chipAge = document.getElementById('chip-age');

    // Preset buttons
    const presetButtons = document.querySelectorAll('.preset-btn');

    // Pill buttons for BHK and Bathrooms
    const pillButtons = document.querySelectorAll('.pill-btn');

    // Setup Pill button click interactions
    pillButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const value = btn.getAttribute('data-value');
            const targetInput = document.getElementById(targetId);

            if (targetInput) {
                targetInput.value = value;

                // Update active state in group
                const parentGroup = btn.closest('.pill-group');
                parentGroup.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Update text display
                if (targetId === 'bhk-input' && bhkDisplay) {
                    bhkDisplay.textContent = `${value} BHK`;
                } else if (targetId === 'bathrooms-input' && bathDisplay) {
                    bathDisplay.textContent = `${value} Baths`;
                }

                updateChips();
                calculateRentAsync();
            }
        });
    });

    // Synchronize Size Slider & Number Input
    if (sizeSlider && sizeInput) {
        sizeSlider.addEventListener('input', (e) => {
            sizeInput.value = e.target.value;
            updateChips();
        });

        sizeSlider.addEventListener('change', () => {
            calculateRentAsync();
        });

        sizeInput.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (!isNaN(val)) {
                sizeSlider.value = Math.min(Math.max(val, 350), 4000);
            }
            updateChips();
        });

        sizeInput.addEventListener('change', () => {
            calculateRentAsync();
        });
    }

    // Quick size tags
    sizeTags.forEach(tag => {
        tag.addEventListener('click', () => {
            const size = tag.getAttribute('data-size');
            sizeInput.value = size;
            sizeSlider.value = size;
            updateChips();
            calculateRentAsync();
        });
    });

    // Synchronize Property Age Slider
    if (ageSlider && ageInput && ageDisplay) {
        ageSlider.addEventListener('input', (e) => {
            const val = e.target.value;
            ageInput.value = val;
            ageDisplay.textContent = `${val} Years`;
            updateChips();
        });

        ageSlider.addEventListener('change', () => {
            calculateRentAsync();
        });
    }

    // Dropdown change listeners
    [citySelect, propertyTypeSelect, furnishingSelect, floorSelect].forEach(select => {
        if (select) {
            select.addEventListener('change', () => {
                updateChips();
                calculateRentAsync();
            });
        }
    });

    // Preset Buttons Handler
    presetButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const city = btn.getAttribute('data-city');
            const bhk = btn.getAttribute('data-bhk');
            const size = btn.getAttribute('data-size');
            const baths = btn.getAttribute('data-baths');
            const type = btn.getAttribute('data-type');
            const furnishing = btn.getAttribute('data-furnishing');
            const floor = btn.getAttribute('data-floor');
            const age = btn.getAttribute('data-age');

            // Apply values
            if (citySelect) citySelect.value = city;
            if (propertyTypeSelect) propertyTypeSelect.value = type;
            if (furnishingSelect) furnishingSelect.value = furnishing;
            if (floorSelect) floorSelect.value = floor;

            if (bhkInput) bhkInput.value = bhk;
            if (bhkDisplay) bhkDisplay.textContent = `${bhk} BHK`;
            setPillActive('bhk-input', bhk);

            if (bathroomsInput) bathroomsInput.value = baths;
            if (bathDisplay) bathDisplay.textContent = `${baths} Baths`;
            setPillActive('bathrooms-input', baths);

            if (sizeInput) sizeInput.value = size;
            if (sizeSlider) sizeSlider.value = size;

            if (ageInput) ageInput.value = age;
            if (ageSlider) ageSlider.value = age;
            if (ageDisplay) ageDisplay.textContent = `${age} Years`;

            updateChips();
            calculateRentAsync();
        });
    });

    // Helper to activate the right pill button
    function setPillActive(targetId, value) {
        const buttons = document.querySelectorAll(`.pill-btn[data-target="${targetId}"]`);
        buttons.forEach(btn => {
            if (btn.getAttribute('data-value') === String(value)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    // Update Summary Chips
    function updateChips() {
        if (chipCity && citySelect) chipCity.textContent = `📍 ${citySelect.value}`;
        if (chipBhk && bhkInput) chipBhk.textContent = `🛏️ ${bhkInput.value} BHK`;
        if (chipSize && sizeInput) chipSize.textContent = `📐 ${sizeInput.value} sq.ft`;
        if (chipBaths && bathroomsInput) chipBaths.textContent = `🚿 ${bathroomsInput.value} Baths`;
        if (chipType && propertyTypeSelect) chipType.textContent = `🏠 ${propertyTypeSelect.value}`;
        if (chipFurnishing && furnishingSelect) chipFurnishing.textContent = `🛋️ ${furnishingSelect.value}`;
        if (chipFloor && floorSelect) chipFloor.textContent = `🏢 ${floorSelect.value} Floor`;
        if (chipAge && ageInput) chipAge.textContent = `⏳ ${ageInput.value} yrs`;
    }

    // Number Counter Animation
    function animateValue(element, start, end, duration) {
        if (!element) return;
        const startTime = performance.now();
        const diff = end - start;

        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // Ease out cubic
            const ease = 1 - Math.pow(1 - progress, 3);
            const current = Math.round(start + diff * ease);

            element.textContent = current.toLocaleString('en-IN');

            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = Math.round(end).toLocaleString('en-IN');
            }
        }

        requestAnimationFrame(update);
    }

    // Async AJAX Prediction
    let debounceTimer = null;
    function calculateRentAsync() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
            const payload = {
                city: citySelect ? citySelect.value : 'Bangalore',
                bhk: bhkInput ? parseInt(bhkInput.value, 10) : 2,
                size_sqft: sizeInput ? parseFloat(sizeInput.value) : 1000,
                bathrooms: bathroomsInput ? parseFloat(bathroomsInput.value) : 2,
                property_type: propertyTypeSelect ? propertyTypeSelect.value : 'Apartment',
                furnishing: furnishingSelect ? furnishingSelect.value : 'Semi-Furnished',
                floor: floorSelect ? floorSelect.value : 'Middle',
                property_age: ageInput ? parseInt(ageInput.value, 10) : 5
            };

            // Loading state
            if (btnSpinner) btnSpinner.style.display = 'inline-block';

            try {
                const response = await fetch('/predict', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }

                const data = await response.json();

                if (data.success) {
                    // Current value for smooth counter transition
                    const currentText = predictedRentVal.textContent.replace(/,/g, '').trim();
                    const currentVal = parseFloat(currentText) || 0;
                    const targetVal = data.predicted_rent;

                    animateValue(predictedRentVal, currentVal, targetVal, 400);

                    if (annualRentVal) annualRentVal.textContent = data.annual_rent;
                    if (sqftRentVal) sqftRentVal.textContent = data.rent_per_sqft;

                    // Subtle pulse effect on card
                    if (predictionBox) {
                        predictionBox.style.transform = 'scale(1.01)';
                        predictionBox.style.borderColor = 'rgba(16, 185, 129, 0.7)';
                        setTimeout(() => {
                            predictionBox.style.transform = 'scale(1)';
                            predictionBox.style.borderColor = 'rgba(16, 185, 129, 0.3)';
                        }, 250);
                    }
                }
            } catch (err) {
                console.error('Prediction request failed:', err);
            } finally {
                if (btnSpinner) btnSpinner.style.display = 'none';
            }
        }, 120);
    }

    // Form Submit Event (AJAX override)
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            calculateRentAsync();
        });
    }

    // Reset button handler
    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            if (citySelect) citySelect.value = 'Bangalore';
            if (propertyTypeSelect) propertyTypeSelect.value = 'Apartment';
            if (furnishingSelect) furnishingSelect.value = 'Semi-Furnished';
            if (floorSelect) floorSelect.value = 'Middle';

            if (bhkInput) bhkInput.value = 2;
            if (bhkDisplay) bhkDisplay.textContent = '2 BHK';
            setPillActive('bhk-input', 2);

            if (bathroomsInput) bathroomsInput.value = 2;
            if (bathDisplay) bathDisplay.textContent = '2 Baths';
            setPillActive('bathrooms-input', 2);

            if (sizeInput) sizeInput.value = 1100;
            if (sizeSlider) sizeSlider.value = 1100;

            if (ageInput) ageInput.value = 5;
            if (ageSlider) ageSlider.value = 5;
            if (ageDisplay) ageDisplay.textContent = '5 Years';

            updateChips();
            calculateRentAsync();
        });
    }

    // Initial sync
    updateChips();
    calculateRentAsync();
});
