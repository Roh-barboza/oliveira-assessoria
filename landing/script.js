document.addEventListener('DOMContentLoaded', () => {
    // Mobile Menu Toggle
    const mobileMenu = document.getElementById('mobile-menu');
    const navMenu = document.getElementById('nav-menu');

    if (mobileMenu && navMenu) {
        mobileMenu.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            mobileMenu.querySelector('i').classList.toggle('fa-bars');
            mobileMenu.querySelector('i').classList.toggle('fa-times');
        });
    }

    // FAQ Accordion
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all items
            faqItems.forEach(i => i.classList.remove('active'));
            
            // Toggle clicked item
            if (!isActive) {
                item.classList.add('active');
            }
        });
    });

    // Fade-in on Scroll (Intersection Observer)
    const fadeElems = document.querySelectorAll('.fade-in');
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    fadeElems.forEach(elem => {
        observer.observe(elem);
    });

    // Form Submission
    const leadsForm = document.getElementById('leads-form');
    const formStatus = document.getElementById('form-status');

    if (leadsForm) {
        leadsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(leadsForm);
            const data = {
                nome: formData.get('nome'),
                whatsapp: formData.get('whatsapp'),
                area: formData.get('area'),
                mensagem: formData.get('mensagem')
            };

            // Show loading status
            formStatus.textContent = 'Enviando...';
            formStatus.style.display = 'block';
            formStatus.style.backgroundColor = '#e3f2fd';
            formStatus.style.color = '#0d47a1';

            try {
                const response = await fetch('https://chaoticcow-n8n.cloudfy.live/webhook/oliveira-leads', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                if (response.ok) {
                    formStatus.textContent = 'Mensagem enviada com sucesso! Entraremos em contato em breve.';
                    formStatus.style.backgroundColor = '#e8f5e9';
                    formStatus.style.color = '#1b5e20';
                    leadsForm.reset();
                } else {
                    throw new Error('Erro ao enviar formulário');
                }
            } catch (error) {
                console.error('Erro:', error);
                formStatus.textContent = 'Ocorreu um erro ao enviar sua mensagem. Por favor, tente novamente ou use o WhatsApp.';
                formStatus.style.backgroundColor = '#ffebee';
                formStatus.style.color = '#b71c1c';
            }
        });
    }

    // Smooth scroll for nav links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                // Close mobile menu if open
                if (navMenu && navMenu.classList.contains('active')) {
                    navMenu.classList.remove('active');
                    if (mobileMenu) {
                        mobileMenu.querySelector('i').classList.add('fa-bars');
                        mobileMenu.querySelector('i').classList.remove('fa-times');
                    }
                }

                window.scrollTo({
                    top: target.offsetTop - 70, // Header height offset
                    behavior: 'smooth'
                });
            }
        });
    });
});
