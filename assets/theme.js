(() => {
  const root = (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  // Mobile menu
  document.querySelectorAll('[data-menu-toggle]').forEach((button) => {
    const menu = document.querySelector('[data-menu]');
    if (!menu) return;
    button.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      button.setAttribute('aria-expanded', String(open));
    });
  });

  // Drop countdown
  document.querySelectorAll('[data-countdown]').forEach((el) => {
    const target = Date.parse(el.dataset.countdown);
    if (Number.isNaN(target)) return;
    const parts = {
      days: el.querySelector('[data-days]'),
      hours: el.querySelector('[data-hours]'),
      minutes: el.querySelector('[data-minutes]'),
      seconds: el.querySelector('[data-seconds]'),
    };
    const pad = (n) => String(n).padStart(2, '0');
    const finish = () => {
      if (el.dataset.doneText) {
        el.textContent = el.dataset.doneText;
        el.classList.add('countdown--done');
        el.hidden = false;
      } else {
        el.hidden = true;
      }
    };
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        clearInterval(timer);
        finish();
        return;
      }
      const s = Math.floor(diff / 1000);
      parts.days.textContent = pad(Math.floor(s / 86400));
      parts.hours.textContent = pad(Math.floor((s % 86400) / 3600));
      parts.minutes.textContent = pad(Math.floor((s % 3600) / 60));
      parts.seconds.textContent = pad(s % 60);
      el.hidden = false;
    };
    const timer = setInterval(tick, 1000);
    tick();
  });

  // Cart count
  const setCartCount = (count) => {
    document.querySelectorAll('[data-cart-count]').forEach((el) => {
      el.textContent = count;
      el.hidden = count === 0;
    });
  };

  // Product page: variant picker + add to cart
  document.querySelectorAll('[data-product-section]').forEach((section) => {
    const jsonEl = section.querySelector('[data-product-json]');
    const form = section.querySelector('[data-product-form]');
    if (!jsonEl || !form) return;
    const product = JSON.parse(jsonEl.textContent);
    const idInput = form.querySelector('[data-variant-id]');
    const button = form.querySelector('[data-add-button]');
    const priceEl = section.querySelector('[data-price]');
    const message = form.querySelector('[data-form-message]');
    const currency = (window.Shopify && window.Shopify.currency && window.Shopify.currency.active) || 'USD';
    const money = (cents) =>
      new Intl.NumberFormat(document.documentElement.lang || undefined, { style: 'currency', currency }).format(cents / 100);

    const selectedOptions = () =>
      Array.from(form.querySelectorAll('[data-option]:checked')).map((input) => input.value);

    const updateAvailability = (selected) => {
      // Dim values that have no available variant when combined with the other current selections.
      form.querySelectorAll('[data-option]').forEach((input) => {
        const position = Number(input.dataset.option) - 1;
        const combo = selected.slice();
        combo[position] = input.value;
        const match = product.variants.find((v) => v.options.every((opt, i) => opt === combo[i]));
        const label = form.querySelector(`label[for="${input.id}"]`);
        if (label) label.classList.toggle('is-unavailable', !match || !match.available);
      });
    };

    const onChange = () => {
      const selected = selectedOptions();
      const variant = product.variants.find((v) => v.options.every((opt, i) => opt === selected[i]));
      selected.forEach((value, i) => {
        const label = form.querySelector(`[data-option-label="${i + 1}"]`);
        if (label) label.textContent = value;
      });
      updateAvailability(selected);
      if (!variant) {
        button.disabled = true;
        button.textContent = 'Unavailable';
        return;
      }
      idInput.value = variant.id;
      button.disabled = !variant.available;
      button.textContent = variant.available ? button.dataset.addLabel || 'Add to cart' : 'Sold out';
      if (priceEl) {
        const compare =
          variant.compare_at_price > variant.price
            ? ` <s class="price__compare">${money(variant.compare_at_price)}</s>`
            : '';
        priceEl.innerHTML = `<span class="price"><span class="price__current">${money(variant.price)}</span>${compare}</span>`;
      }
      if (section.hasAttribute('data-update-url')) {
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url);
      }
    };

    form.querySelectorAll('[data-option]').forEach((input) => input.addEventListener('change', onChange));
    if (form.querySelector('[data-option]')) updateAvailability(selectedOptions());

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const label = button.textContent;
      button.disabled = true;
      button.textContent = 'Adding…';
      message.hidden = true;
      try {
        const res = await fetch(`${root}cart/add.js`, {
          method: 'POST',
          headers: { Accept: 'application/json' },
          body: new FormData(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.description || data.message || 'Could not add to cart');
        const cart = await fetch(`${root}cart.js`).then((r) => r.json());
        setCartCount(cart.item_count);
        message.className = 'form-message form-message--success';
        message.innerHTML = `Added to cart. <a href="${root}cart">View cart &amp; check out</a>`;
      } catch (error) {
        message.className = 'form-message form-message--error';
        message.textContent = error.message;
      }
      message.hidden = false;
      button.textContent = label;
      button.disabled = false;
    });
  });
})();
