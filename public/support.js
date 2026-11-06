(() => {
  const params = new URLSearchParams(location.search);
  const interest = params.get('interest');
  const message = document.querySelector('#contact-form #message');
  if (interest && message && !message.value) message.value = 'I’m interested in ' + interest.slice(0, 200) + '.\n\n';
  document.querySelectorAll('.detail-form input, .detail-form select, .detail-form textarea').forEach(field => {
    if (document.getElementById('form-msg') && field.type !== 'hidden' && field.getAttribute('aria-hidden') !== 'true') field.setAttribute('aria-describedby', 'form-msg');
  });
})();
