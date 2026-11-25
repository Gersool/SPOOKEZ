/* =========================================================
   SPOOKEZ — JAVASCRIPT
========================================================= */

/* =========================================================
   UTILIDADES
========================================================= */
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];

const formatPrice = (price) =>
    Number(price).toFixed(2).replace('.', ',') + ' €';

const showToast = (message) => {
    const toast = $('#toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
};

const openLayer = (id) => {
    const layer = document.getElementById(id);
    if (!layer) return;
    layer.classList.add('is-open');
    document.body.classList.add('no-scroll');
};

const closeLayer = (id) => {
    const layer = document.getElementById(id);
    if (!layer) return;
    layer.classList.remove('is-open');
    if (!$('.is-open')) document.body.classList.remove('no-scroll');
};

/* =========================================================
   LOADER
========================================================= */
const initLoader = () => {
    const loader = $('#loader');
    const ghost = $('#loaderGhost');
    const canvas = $('#loaderTrail');
    if (!loader || !ghost || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let raf = 0;
    let x = 0;
    let y = 0;
    let vx = 0;
    let vy = 0;
    let lastTime = performance.now();
    const started = lastTime;
    const duration = 5200;
    const ghostW = 54;
    const ghostH = 68;
    const trail = [];
    const maxTrail = 18;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const resize = () => {
        // El canvas del loader no necesita resolución Retina completa: limitarla
        // reduce muchísimo el coste de pintar cada frame sin que se note visualmente.
        const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        x = Math.max(ghostW / 2 + 6, Math.min(width - ghostW / 2 - 6, x));
        y = Math.max(ghostH / 2 + 6, Math.min(height - ghostH / 2 - 6, y));
    };

    resize();
    window.addEventListener('resize', resize, { passive: true });

    x = width * 0.50;
    y = height * 0.34;
    vx = (Math.random() > 0.5 ? 1 : -1) * 430;
    vy = -210;

    const drawTrail = () => {
        ctx.clearRect(0, 0, width, height);
        if (trail.length < 2) return;

        const tail = trail[0];
        const head = trail[trail.length - 1];
        const gradient = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
        gradient.addColorStop(0, 'rgba(255,255,255,0)');
        gradient.addColorStop(0.38, 'rgba(255,255,255,.10)');
        gradient.addColorStop(0.82, 'rgba(255,255,255,.38)');
        gradient.addColorStop(1, 'rgba(255,255,255,.78)');

        // Una única trayectoria + dos pasadas limpias. Sin shadowBlur, sin
        // partículas y sin decenas de strokes independientes.
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = gradient;

        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
        ctx.lineWidth = 6;
        ctx.globalAlpha = .42;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        for (let i = 1; i < trail.length; i++) ctx.lineTo(trail[i].x, trail[i].y);
        ctx.lineWidth = 2.2;
        ctx.globalAlpha = .9;
        ctx.stroke();
        ctx.restore();
    };

    const finish = () => {
        cancelAnimationFrame(raf);
        loader.classList.add('is-done');
        window.removeEventListener('resize', resize);
        ctx.clearRect(0, 0, width, height);
    };

    const animate = (now) => {
        const dt = Math.min((now - lastTime) / 1000, 0.032);
        lastTime = now;

        if (now - started >= duration) {
            finish();
            return;
        }

        x += vx * dt;
        y += vy * dt;
        vy += 720 * dt;

        const minX = ghostW / 2 + 6;
        const maxX = width - ghostW / 2 - 6;
        const minY = ghostH / 2 + 6;
        const maxY = height - ghostH / 2 - 6;
        let hit = false;

        if (x <= minX) {
            x = minX;
            vx = Math.abs(vx) * 1.01;
            hit = true;
        } else if (x >= maxX) {
            x = maxX;
            vx = -Math.abs(vx) * 1.01;
            hit = true;
        }

        if (y <= minY) {
            y = minY;
            vy = Math.abs(vy) * .90;
            hit = true;
        } else if (y >= maxY) {
            y = maxY;
            vy = -(Math.abs(vy) * 1.02 + 180);
            hit = true;
        }

        if (Math.abs(vx) < 270) vx = Math.sign(vx || 1) * 270;
        vx = Math.max(-650, Math.min(650, vx));

        // El rastro guarda posiciones, no objetos visuales. Muy poca memoria y
        // una cantidad fija de trabajo por frame.
        trail.push({ x, y });
        if (trail.length > maxTrail) trail.shift();
        drawTrail();

        const angle = Math.max(-18, Math.min(18, vx / 34));
        const squash = hit ? .86 : 1;
        ghost.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(${angle}deg) scale(${hit ? 1.06 : 1}, ${squash})`;
        ghost.classList.toggle('is-impacting', hit);

        raf = requestAnimationFrame(animate);
    };

    ghost.style.left = '0px';
    ghost.style.top = '0px';
    ghost.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;

    if (reducedMotion) {
        ghost.style.transform = `translate3d(${width * .5}px, ${height * .34}px, 0) translate(-50%, -50%)`;
        setTimeout(finish, 900);
        return;
    }

    raf = requestAnimationFrame(animate);
};

/* =========================================================
   HEADER / MENÚ
========================================================= */
const initHeader = () => {
    const header = $('#header');
    const menuButton = $('#menuButton');
    const nav = $('#nav');

    window.addEventListener('scroll', () => {
        header.classList.toggle('scrolled', window.scrollY > 25);
        $('#backTop').classList.toggle('is-visible', window.scrollY > 550);
    });

    menuButton?.addEventListener('click', () => nav.classList.toggle('is-open'));

    $$('.nav a').forEach(link => {
        link.addEventListener('click', () => nav.classList.remove('is-open'));
    });

    $('#backTop')?.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
};

/* =========================================================
   CARRITO
========================================================= */
let cart = JSON.parse(localStorage.getItem('spookezCart') || '[]');

const saveCart = () => localStorage.setItem('spookezCart', JSON.stringify(cart));

const renderCart = () => {
    const itemsContainer = $('#cartItems');
    const count = cart.reduce((sum, item) => sum + item.quantity, 0);
    const total = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

    $('#cartCount').textContent = count;
    $('#cartTotal').textContent = formatPrice(total);

    if (!cart.length) {
        itemsContainer.innerHTML = '<div class="empty-cart">' + (window.SpookezI18n ? SpookezI18n.t('cart.empty') : 'TU CARRITO ESTÁ VACÍO.') + '</div>';
        saveCart();
        return;
    }

    itemsContainer.innerHTML = cart.map((item, index) => `
        <div class="cart-item">
            <img src="${item.image}" alt="${item.name}">
            <div class="cart-item__info">
                <h4>${item.name}</h4>
                <p>${formatPrice(item.price)}</p>
                <div class="qty">
                    <button data-action="decrease" data-index="${index}">−</button>
                    <span>${item.quantity}</span>
                    <button data-action="increase" data-index="${index}">+</button>
                </div>
            </div>
            <button class="cart-remove" data-action="remove" data-index="${index}">${window.SpookezI18n ? SpookezI18n.t('cart.remove') : 'ELIMINAR'}</button>
        </div>
    `).join('');

    saveCart();
};

const addToCart = (product) => {
    const existing = cart.find(item => item.name === product.name);

    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({
            name: product.name,
            price: product.price,
            image: product.image,
            quantity: 1
        });
    }

    renderCart();
    showToast(`${product.name} ` + (window.SpookezI18n ? SpookezI18n.t('cart.added') : 'añadido al carrito'));
};

const initCart = () => {
    renderCart();

    $('#cartButton').addEventListener('click', () => openLayer('cartOverlay'));

    $('#cartItems').addEventListener('click', (event) => {
        const button = event.target.closest('[data-action]');
        if (!button) return;

        const index = Number(button.dataset.index);
        const action = button.dataset.action;

        if (action === 'increase') cart[index].quantity += 1;
        if (action === 'decrease') cart[index].quantity -= 1;
        if (action === 'remove' || cart[index]?.quantity <= 0) cart.splice(index, 1);

        renderCart();
    });

    $$('.add-button').forEach(button => {
        button.addEventListener('click', () => {
            const card = button.closest('.product');
            addToCart({
                name: card.dataset.name,
                price: Number(card.dataset.price),
                image: card.dataset.image
            });
        });
    });
};

/* =========================================================
   PRODUCTOS / FILTROS / BÚSQUEDA
========================================================= */
const initProducts = () => {
    const products = $$('.product');
    const filters = $$('.filter');
    const searchInput = $('#searchInput');
    let activeFilter = 'all';

    const applyFilters = () => {
        const query = searchInput.value.trim().toLowerCase();
        let visible = 0;

        products.forEach(product => {
            const category = product.dataset.category;
            const name = product.dataset.name.toLowerCase();
            const categoryMatch = activeFilter === 'all' || category === activeFilter;
            const searchMatch = name.includes(query);
            const show = categoryMatch && searchMatch;

            product.classList.toggle('is-hidden-product', !show);
            if (show) visible += 1;
        });

        $('#noResults').style.display = visible ? 'none' : 'block';
    };

    filters.forEach(filter => {
        filter.addEventListener('click', () => {
            filters.forEach(button => button.classList.remove('is-active'));
            filter.classList.add('is-active');
            activeFilter = filter.dataset.filter;
            applyFilters();
        });
    });

    searchInput.addEventListener('input', applyFilters);

    $$('.product__favorite').forEach(button => {
        button.addEventListener('click', () => {
            button.classList.toggle('is-liked');
            button.textContent = button.classList.contains('is-liked') ? '♥' : '♡';
            showToast(button.classList.contains('is-liked') ? 'Añadido a favoritos' : 'Eliminado de favoritos');
        });
    });
};

/* =========================================================
   VISTA RÁPIDA
========================================================= */
let selectedProduct = null;

const initQuickView = () => {
    $$('.product__quick').forEach(button => {
        button.addEventListener('click', () => {
            const card = button.closest('.product');
            selectedProduct = {
                name: card.dataset.name,
                price: Number(card.dataset.price),
                image: card.dataset.image,
                category: $('.product__category', card).textContent,
                description: `Una pieza Spookez pensada para combinar diseño oscuro, identidad y streetwear.`
            };

            $('#modalImage').src = selectedProduct.image;
            $('#modalImage').alt = selectedProduct.name;
            $('#modalName').textContent = selectedProduct.name;
            $('#modalCategory').textContent = selectedProduct.category;
            $('#modalPrice').textContent = formatPrice(selectedProduct.price);
            $('#modalDescription').textContent = selectedProduct.description;
            openLayer('productModal');
        });
    });

    $('#modalAdd').addEventListener('click', () => {
        if (!selectedProduct) return;
        addToCart(selectedProduct);
        closeLayer('productModal');
        openLayer('cartOverlay');
    });
};

/* =========================================================
   CUENTA / LOGIN / REGISTRO
   NOTA: DEMO LOCAL, NO ES AUTENTICACIÓN REAL.
========================================================= */
let currentUser = JSON.parse(localStorage.getItem('spookezUser') || 'null');

const renderAccount = () => {
    const loggedOut = $('#accountLoggedOut');
    const loggedIn = $('#accountLoggedIn');

    loggedOut.classList.toggle('is-hidden', Boolean(currentUser));
    loggedIn.classList.toggle('is-hidden', !currentUser);

    if (currentUser) {
        $('#accountName').textContent = currentUser.name.toUpperCase();
        $('#accountEmail').textContent = currentUser.email;
    }
};

const initAccount = () => {
    renderAccount();

    $('#accountButton').addEventListener('click', () => {
        renderAccount();
        openLayer('accountModal');
    });

    $$('.auth-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            $$('.auth-tab').forEach(item => item.classList.remove('is-active'));
            tab.classList.add('is-active');

            const login = tab.dataset.auth === 'login';
            $('#loginForm').classList.toggle('is-hidden', !login);
            $('#registerForm').classList.toggle('is-hidden', login);
        });
    });

    $('#registerForm').addEventListener('submit', (event) => {
        event.preventDefault();

        currentUser = {
            name: $('#registerName').value.trim(),
            email: $('#registerEmail').value.trim().toLowerCase()
        };

        localStorage.setItem('spookezUser', JSON.stringify(currentUser));
        renderAccount();
        showToast('Cuenta creada correctamente');
    });

    $('#loginForm').addEventListener('submit', (event) => {
        event.preventDefault();

        currentUser = {
            name: $('#loginEmail').value.split('@')[0],
            email: $('#loginEmail').value.trim().toLowerCase()
        };

        localStorage.setItem('spookezUser', JSON.stringify(currentUser));
        renderAccount();
        showToast('Sesión iniciada');
    });

    $('#logoutButton').addEventListener('click', () => {
        currentUser = null;
        localStorage.removeItem('spookezUser');
        renderAccount();
        showToast('Sesión cerrada');
    });
};

/* =========================================================
   CHECKOUT + STRIPE
   1) Envía datos al backend
   2) Backend crea sesión de Stripe Checkout
   3) Redirige al pago seguro de Stripe
   4) Al volver, confirma y guarda el pedido en SQLite
========================================================= */
const API_BASE = ''; // mismo origen cuando se sirve desde el backend

const initCheckout = () => {
    // Si volvemos de Stripe con ?session_id=...
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (sessionId) {
        confirmStripeSession(sessionId);
    }

    $('#checkoutButton').addEventListener('click', () => {
        if (!cart.length) {
            showToast(window.SpookezI18n ? SpookezI18n.t('toast.emptyCart') : 'Tu carrito está vacío');
            return;
        }

        if (currentUser) {
            $('#checkoutName').value = currentUser.name;
            $('#checkoutEmail').value = currentUser.email;
        }

        closeLayer('cartOverlay');
        openLayer('checkoutModal');
    });

    $('#checkoutForm').addEventListener('submit', async (event) => {
        event.preventDefault();

        const form = event.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = 'REDIRIGIENDO A STRIPE…';

        const payload = {
            customer_name: $('#checkoutName').value.trim(),
            customer_email: $('#checkoutEmail').value.trim(),
            address: ($('#checkoutAddress')?.value || '').trim(),
            city: ($('#checkoutCity')?.value || '').trim(),
            postal_code: ($('#checkoutPostal')?.value || '').trim(),
            country: 'España',
            items: cart.map(item => ({
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                image: item.image
            }))
        };

        try {
            const res = await fetch(`${API_BASE}/api/create-checkout-session`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();

            if (!res.ok || !data.ok) {
                throw new Error(data.error || 'No se pudo iniciar el pago');
            }

            // Guardar datos del carrito por si hace falta (Stripe redirige fuera)
            sessionStorage.setItem('spookezPendingCheckout', JSON.stringify(payload));

            // Redirigir a Stripe Checkout
            window.location.href = data.url;
        } catch (err) {
            console.error(err);
            showToast(err.message || 'Error de conexión con el servidor');
            submitBtn.disabled = false;
            submitBtn.textContent = originalText;
        }
    });
};

const confirmStripeSession = async (sessionId) => {
    try {
        showToast('Confirmando pago…');
        const res = await fetch(`${API_BASE}/api/confirm-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId })
        });
        const data = await res.json();

        // Limpiar URL
        window.history.replaceState({}, document.title, window.location.pathname);

        if (!res.ok || !data.ok) {
            showToast(data.error || 'No se pudo confirmar el pago');
            return;
        }

        $('#orderNumber').textContent = data.order.order_number;
        cart = [];
        renderCart();
        sessionStorage.removeItem('spookezPendingCheckout');
        openLayer('successModal');
        showToast('Pago confirmado · Pedido guardado');
    } catch (err) {
        console.error(err);
        showToast('Error al confirmar el pago');
    }
};

/* =========================================================
   CONTACTO
========================================================= */
const initContact = () => {
    $('#contactForm').addEventListener('submit', (event) => {
        event.preventDefault();
        event.target.reset();
        showToast('Mensaje preparado correctamente');
    });
};

/* =========================================================
   CERRAR MODALES / OVERLAYS
========================================================= */
const initLayers = () => {
    $$('[data-close]').forEach(button => {
        button.addEventListener('click', () => closeLayer(button.dataset.close));
    });

    $$('.drawer-overlay, .modal').forEach(layer => {
        layer.addEventListener('click', (event) => {
            if (event.target === layer) closeLayer(layer.id);
        });
    });

    document.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        $$('.is-open').forEach(layer => closeLayer(layer.id));
    });
};


/* =========================================================
   INTERACCIÓN VISUAL
========================================================= */
const initVisualInteractions = () => {
    const glow = $('#cursorGlow');
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    let mouseX = window.innerWidth * .5;
    let mouseY = window.innerHeight * .5;
    let glowX = mouseX;
    let glowY = mouseY;
    let glowRaf = 0;
    let glowActive = false;
    let stopTimer = 0;

    if (glow && finePointer) {
        const moveGlow = () => {
            glowX += (mouseX - glowX) * .18;
            glowY += (mouseY - glowY) * .18;
            glow.style.transform = `translate3d(${glowX}px, ${glowY}px, 0)`;

            if (Math.abs(mouseX - glowX) < .4 && Math.abs(mouseY - glowY) < .4) {
                glowActive = false;
                glowRaf = 0;
                return;
            }
            glowRaf = requestAnimationFrame(moveGlow);
        };

        window.addEventListener('pointermove', (event) => {
            mouseX = event.clientX;
            mouseY = event.clientY;
            if (!glowActive) {
                glowActive = true;
                if (!glowRaf) glowRaf = requestAnimationFrame(moveGlow);
            }
            clearTimeout(stopTimer);
            stopTimer = setTimeout(() => {
                glowActive = false;
            }, 80);
        }, { passive: true });
    }

    // Tilt: solo se recalcula mientras el puntero está encima de una tarjeta.
    // No hay ningún bucle de animación global para los productos.
    if (finePointer) {
        $$('.product').forEach(card => {
            let tiltRaf = 0;
            let pendingEvent = null;

            card.addEventListener('pointermove', (event) => {
                pendingEvent = event;
                if (tiltRaf) return;

                tiltRaf = requestAnimationFrame(() => {
                    tiltRaf = 0;
                    if (!pendingEvent) return;
                    const rect = card.getBoundingClientRect();
                    const px = (pendingEvent.clientX - rect.left) / rect.width - .5;
                    const py = (pendingEvent.clientY - rect.top) / rect.height - .5;
                    card.style.setProperty('--rx', `${py * -4}deg`);
                    card.style.setProperty('--ry', `${px * 5}deg`);
                    card.style.setProperty('--mx', `${(px + .5) * 100}%`);
                    card.style.setProperty('--my', `${(py + .5) * 100}%`);
                    pendingEvent = null;
                });
            }, { passive: true });

            card.addEventListener('pointerleave', () => {
                pendingEvent = null;
                if (tiltRaf) cancelAnimationFrame(tiltRaf);
                tiltRaf = 0;
                card.style.setProperty('--rx', '0deg');
                card.style.setProperty('--ry', '0deg');
            }, { passive: true });
        });
    }

    const revealItems = $$('.section-heading, .product, .story__grid, .store-card, .contact__grid');
    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-revealed');
                observer.unobserve(entry.target);
            });
        }, { threshold: .10, rootMargin: '0px 0px -30px 0px' });
        revealItems.forEach(item => observer.observe(item));
    } else {
        revealItems.forEach(item => item.classList.add('is-revealed'));
    }
};

/* =========================================================
   EASTER EGG SPOOKEZY — GLITCH + 808 ORIGINAL
========================================================= */
let spookezAudioContext = null;

const playSpookezBass = () => {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    if (!spookezAudioContext) spookezAudioContext = new AudioCtx();
    const audio = spookezAudioContext;
    if (audio.state === 'suspended') audio.resume();

    const now = audio.currentTime;
    const master = audio.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.48, now + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.72);
    master.connect(audio.destination);

    const distortion = audio.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
        const n = i * 2 / (curve.length - 1) - 1;
        curve[i] = Math.tanh(n * 5.2);
    }
    distortion.curve = curve;
    distortion.oversample = '4x';
    distortion.connect(master);

    const bass = audio.createOscillator();
    bass.type = 'sine';
    bass.frequency.setValueAtTime(58, now);
    bass.frequency.exponentialRampToValueAtTime(32, now + 0.56);
    const bassGain = audio.createGain();
    bassGain.gain.setValueAtTime(0.001, now);
    bassGain.gain.exponentialRampToValueAtTime(1, now + 0.015);
    bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.62);
    bass.connect(bassGain).connect(distortion);
    bass.start(now);
    bass.stop(now + 0.66);

    // Chispa aguda tipo screamer, generada al vuelo.
    const scream = audio.createOscillator();
    scream.type = 'sawtooth';
    scream.frequency.setValueAtTime(720, now);
    scream.frequency.exponentialRampToValueAtTime(180, now + 0.16);
    const screamFilter = audio.createBiquadFilter();
    screamFilter.type = 'highpass';
    screamFilter.frequency.value = 620;
    const screamGain = audio.createGain();
    screamGain.gain.setValueAtTime(0.0001, now);
    screamGain.gain.exponentialRampToValueAtTime(0.22, now + 0.006);
    screamGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    scream.connect(screamFilter).connect(screamGain).connect(master);
    scream.start(now);
    scream.stop(now + 0.27);
};

const triggerSpookezEasterEgg = (event) => {
    if (event) event.preventDefault();
    const targets = $$('.spookez-trigger');
    document.body.classList.remove('spookez-nightmare');
    void document.body.offsetWidth;
    document.body.classList.add('spookez-nightmare');
    playSpookezBass();

    targets.forEach(target => {
        target.classList.remove('logo-corrupt');
        void target.offsetWidth;
        target.classList.add('logo-corrupt');
        setTimeout(() => target.classList.remove('logo-corrupt'), 1750);
    });

    clearTimeout(triggerSpookezEasterEgg.timer);
    triggerSpookezEasterEgg.timer = setTimeout(() => {
        document.body.classList.remove('spookez-nightmare');
        window.scrollTo({ top: window.scrollY, behavior: 'auto' });
    }, 1750);
};

const initSpookezEasterEgg = () => {
    $$('.spookez-trigger').forEach(target => {
        target.addEventListener('click', triggerSpookezEasterEgg);
    });
};

/* =========================================================
   ARRANQUE
========================================================= */
document.addEventListener('DOMContentLoaded', () => {
    initLoader();
    initHeader();
    initCart();
    initProducts();
    initQuickView();
    initAccount();
    initCheckout();
    initContact();
    initLayers();
    initVisualInteractions();
    initSpookezEasterEgg();
});

/* =========================================================
   i18n + ACCESIBILIDAD + YOUTUBE (reproductor oficial)
========================================================= */
const initI18nUI = () => {
    if (!window.SpookezI18n) return;
    const select = $('#langSelect');
    const current = SpookezI18n.getLang();
    if (select) {
        select.value = current;
        select.addEventListener('change', () => {
            SpookezI18n.setLang(select.value);
            const cap = $('#videoCaptionLang');
            if (cap) {
                const map = { es: 'es', en: 'en', zh: 'zh-Hans', de: 'de' };
                cap.value = map[select.value] || 'es';
                // Recargar iframes ya insertados con nuevo idioma de subtítulos
                $$('.video-frame iframe').forEach((iframe) => {
                    const id = iframe.closest('.video-frame')?.dataset.youtubeId;
                    if (id) iframe.src = buildYoutubeSrc(id, cap.value);
                });
            }
        });
    }
    SpookezI18n.apply();
    document.addEventListener('spookez:lang', () => {
        // Actualizar placeholders dinámicos del carrito vacío etc. en próximo render
        if (typeof renderCart === 'function') renderCart();
    });
};

/* Voz bajo demanda (Web Speech API). No es Loquendo Carlos (propietario),
   pero elige voz masculina es-ES del sistema si existe. Solo lee clic/selección. */
const SpookezTTS = (() => {
    const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
    let preferredVoice = null;

    const pickVoice = () => {
        if (!supported) return null;
        const voices = window.speechSynthesis.getVoices() || [];
        const lang = (window.SpookezI18n ? SpookezI18n.getLang() : 'es');
        const langMap = { es: 'es', en: 'en', zh: 'zh', de: 'de' };
        const want = langMap[lang] || 'es';
        // Preferir voces masculinas / nombres tipo Carlos, Jorge, Diego, Pablo…
        const maleHints = /carlos|jorge|diego|pablo|miguel|antonio|male|hombre|man|david|mark|stefan|yunyang/i;
        const byLang = voices.filter((v) => (v.lang || '').toLowerCase().startsWith(want));
        const male = byLang.find((v) => maleHints.test(v.name)) || byLang.find((v) => /male/i.test(v.name));
        preferredVoice = male || byLang[0] || voices.find((v) => (v.lang || '').toLowerCase().startsWith('es')) || voices[0] || null;
        return preferredVoice;
    };

    if (supported) {
        pickVoice();
        window.speechSynthesis.onvoiceschanged = () => pickVoice();
    }

    const stop = () => {
        if (!supported) return;
        window.speechSynthesis.cancel();
    };

    const speak = (text) => {
        if (!supported) return;
        const clean = String(text || '').replace(/\s+/g, ' ').trim();
        if (!clean) return;
        stop();
        const u = new SpeechSynthesisUtterance(clean);
        const voice = preferredVoice || pickVoice();
        if (voice) u.voice = voice;
        const lang = window.SpookezI18n ? SpookezI18n.getLang() : 'es';
        const langTag = { es: 'es-ES', en: 'en-US', zh: 'zh-CN', de: 'de-DE' }[lang] || 'es-ES';
        u.lang = (voice && voice.lang) || langTag;
        u.rate = 1;
        u.pitch = 1;
        window.speechSynthesis.speak(u);
    };

    const speakSelection = () => {
        const sel = window.getSelection && String(window.getSelection());
        if (sel && sel.trim()) {
            speak(sel);
            return true;
        }
        return false;
    };

    return { supported, speak, speakSelection, stop, pickVoice };
})();

const initA11yPrefs = () => {
    const panel = $('#a11yPanel');
    const toggle = $('#a11yToggle');
    const keys = {
        contrast: 'spookezA11yContrast',
        large: 'spookezA11yLarge',
        motion: 'spookezA11yMotion',
        speakClick: 'spookezA11ySpeakClick'
    };

    const applyPref = (cls, on) => document.body.classList.toggle(cls, on);

    const contrast = $('#a11yContrast');
    const large = $('#a11yLarge');
    const motion = $('#a11yMotion');
    const speakClick = $('#a11ySpeakClick');
    const speakSelBtn = $('#a11ySpeakSel');
    const speakStopBtn = $('#a11ySpeakStop');

    if (contrast) {
        contrast.checked = localStorage.getItem(keys.contrast) === '1';
        applyPref('a11y-contrast', contrast.checked);
        contrast.addEventListener('change', () => {
            localStorage.setItem(keys.contrast, contrast.checked ? '1' : '0');
            applyPref('a11y-contrast', contrast.checked);
        });
    }
    if (large) {
        large.checked = localStorage.getItem(keys.large) === '1';
        applyPref('a11y-large', large.checked);
        large.addEventListener('change', () => {
            localStorage.setItem(keys.large, large.checked ? '1' : '0');
            applyPref('a11y-large', large.checked);
        });
    }
    if (motion) {
        const prefers = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        motion.checked = localStorage.getItem(keys.motion) === '1' || prefers;
        applyPref('a11y-motion', motion.checked);
        motion.addEventListener('change', () => {
            localStorage.setItem(keys.motion, motion.checked ? '1' : '0');
            applyPref('a11y-motion', motion.checked);
        });
    }

    // Leer solo al clic / selección (no toda la página)
    if (speakClick) {
        speakClick.checked = localStorage.getItem(keys.speakClick) === '1';
        applyPref('a11y-speak-click', speakClick.checked);
        speakClick.addEventListener('change', () => {
            localStorage.setItem(keys.speakClick, speakClick.checked ? '1' : '0');
            applyPref('a11y-speak-click', speakClick.checked);
            if (!speakClick.checked) SpookezTTS.stop();
        });
    }

    speakSelBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!SpookezTTS.speakSelection()) {
            // Si no hay selección, avisar brevemente
            const msg = window.SpookezI18n ? SpookezI18n.t('a11y.speakHint') : 'Selecciona texto primero';
            if (typeof showToast === 'function') showToast(msg.slice(0, 80));
        }
    });

    speakStopBtn?.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        SpookezTTS.stop();
    });

    document.addEventListener('click', (e) => {
        if (!speakClick?.checked) return;
        if (e.target.closest('.a11y-bar, .a11y-panel, #a11yToggle, #a11ySpeakSel, #a11ySpeakStop')) return;
        if (e.target.closest('input, textarea, select, button, a.brand')) return;
        const el = e.target.closest('p, h1, h2, h3, h4, li, span, label, strong, em, .product__category, .product__info, .hero__description, .section-heading__text, .store-card, .video-card__meta, .drawer__note, .eyebrow, .button, .filter, .add-button');
        if (!el) return;
        const text = (el.innerText || el.textContent || '').trim();
        if (text.length < 2) return;
        e.preventDefault();
        SpookezTTS.speak(text);
    }, true);

    // Atajo: Alt+S = leer selección
    document.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 's' || e.key === 'S')) {
            e.preventDefault();
            SpookezTTS.speakSelection();
        }
        if (e.key === 'Escape') SpookezTTS.stop();
    });

    document.addEventListener('spookez:lang', () => SpookezTTS.pickVoice());

    toggle?.addEventListener('click', () => {
        const open = panel?.hasAttribute('hidden') === false && panel.classList.contains('is-open');
        if (!panel) return;
        if (open) {
            panel.classList.remove('is-open');
            panel.hidden = true;
            toggle.setAttribute('aria-expanded', 'false');
        } else {
            panel.hidden = false;
            panel.classList.add('is-open');
            toggle.setAttribute('aria-expanded', 'true');
            SpookezTTS.pickVoice();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && panel?.classList.contains('is-open')) {
            panel.classList.remove('is-open');
            panel.hidden = true;
            toggle?.setAttribute('aria-expanded', 'false');
            toggle?.focus();
        }
    });
};

function buildYoutubeSrc(videoId, lang) {
    const cc = encodeURIComponent(lang || 'es');
    // youtube-nocookie + parámetros de subtítulos / UI en idioma
    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1&cc_load_policy=1&cc_lang_pref=${cc}&hl=${cc}&playsinline=1&origin=` + encodeURIComponent(location.origin || '');
}

const initVideos = () => {
    const captionSelect = $('#videoCaptionLang');
    const mapLang = () => {
        const ui = window.SpookezI18n ? SpookezI18n.getLang() : 'es';
        const m = { es: 'es', en: 'en', zh: 'zh-Hans', de: 'de' };
        return captionSelect?.value || m[ui] || 'es';
    };
    if (captionSelect && window.SpookezI18n) {
        const m = { es: 'es', en: 'en', zh: 'zh-Hans', de: 'de' };
        captionSelect.value = m[SpookezI18n.getLang()] || 'es';
    }

    captionSelect?.addEventListener('change', () => {
        $$('.video-frame iframe').forEach((iframe) => {
            const id = iframe.closest('.video-frame')?.dataset.youtubeId;
            if (id) iframe.src = buildYoutubeSrc(id, captionSelect.value);
        });
    });

    const loadVideo = (frame) => {
        if (!frame || frame.querySelector('iframe')) return;
        const id = frame.dataset.youtubeId;
        if (!id) return;
        const iframe = document.createElement('iframe');
        iframe.src = buildYoutubeSrc(id, mapLang());
        iframe.title = frame.dataset.titleKey && window.SpookezI18n
            ? SpookezI18n.t(frame.dataset.titleKey)
            : 'YouTube video';
        iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
        iframe.allowFullscreen = true;
        iframe.loading = 'lazy';
        iframe.referrerPolicy = 'strict-origin-when-cross-origin';
        iframe.addEventListener('error', () => {
            frame.innerHTML = `<p role="alert" style="padding:20px;color:#ccc">${window.SpookezI18n ? SpookezI18n.t('videos.error') : 'Error'}</p>`;
        });
        frame.innerHTML = '';
        frame.appendChild(iframe);
    };

    $$('[data-load-video]').forEach((btn) => {
        btn.addEventListener('click', () => loadVideo(btn.closest('.video-frame')));
    });

    // Lazy: al entrar en viewport, solo mostramos el botón; el iframe se carga al clic
    // (evita bloqueos y ahorra red). Opcionalmente auto-load al visible:
    if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                // No auto-insertamos iframe hasta interacción (mejor para rendimiento y consentimiento implícito)
                io.unobserve(entry.target);
            });
        }, { rootMargin: '100px' });
        $$('.video-frame').forEach((f) => io.observe(f));
    }
};

// Hook into DOMContentLoaded chain
document.addEventListener('DOMContentLoaded', () => {
    initI18nUI();
    initA11yPrefs();
    initVideos();
});
