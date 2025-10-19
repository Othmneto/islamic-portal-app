document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const namesListContainer = document.getElementById('namesList');
    const searchInput = document.getElementById('searchInput');
    const loadingMessage = document.getElementById('loading-message');
    let allNamesData = []; // This will store the complete data from the API

    // --- DICTIONARY FOR UI TRANSLATIONS ---
    const uiTranslations = {
        // UI Labels
        root: { en: 'Root', ar: 'الجذر', fr: 'Racine', id: 'Akar', ur: 'جڑ', bn: 'মূল', tr: 'Kök', fa: 'ریشه', sw: 'Mzizi', ru: 'Корень', ha: 'Asali', ber: 'Aẓar', zh: '词根', ms: 'Akar', am: 'ሥር' },
        category: { en: 'Category', ar: 'الفئة', fr: 'Catégorie', id: 'Kategori', ur: 'زمرہ', bn: 'বিভাগ', tr: 'Kategori', fa: 'دسته بندی', sw: 'Kategoria', ru: 'Категория', ha: 'Rukuni', ber: 'Taggayt', zh: '类别', ms: 'Kategori', am: 'ምድብ' },
        details_language: { en: 'Details Language', ar: 'لغة التفاصيل', fr: 'Langue des détails', id: 'Bahasa Detail', ur: 'تفصیلات کی زبان', bn: 'বিস্তারিত ভাষা', tr: 'Detayların Dili', fa: 'زبان جزئیات', sw: 'Lugha ya Maelezo', ru: 'Язык Деталей', ha: 'Harshen Cikakken Bayani', ber: 'Tutlayt n Tifratin', zh: '详细信息语言', ms: 'Bahasa Butiran', am: 'ዝርዝር ቋንቋ' },

        // Section Title Translations
        explanations: { en: 'Explanations', ar: 'الشروحات', fr: 'Explications', id: 'Penjelasan', ur: 'تشریحات', bn: 'ব্যাখ্যা', tr: 'Açıklamalar', fa: 'توضیحات', sw: 'Maelezo', ru: 'Объяснения', ha: 'Bayanai', ber: 'Tifaskiwin', zh: '解释', ms: 'Penjelasan', am: 'ማብራሪያዎች' },
        invocation: { en: 'Invocation', ar: 'الدعاء', fr: 'Invocation', id: 'Doa', ur: 'دعا', bn: 'দুআ', tr: 'Dua', fa: 'دعا', sw: 'Dua', ru: 'Мольба', ha: 'Addu\'a', ber: 'Dduɛa', zh: '祈祷', ms: 'Doa', am: 'ዱዓ' },
        use_case: { en: 'Use Case', ar: 'حالة الاستخدام', fr: 'Cas d\'utilisation', id: 'Contoh Penggunaan', ur: 'استعمال', bn: 'ব্যবহার', tr: 'Kullanım Şekli', fa: 'کاربرد', sw: 'Matumizi', ru: 'Применение', ha: 'Amfani', ber: 'Asemres', zh: '使用案例', ms: 'Kes Penggunaan', am: 'አጠቃቀም' },
        tafsir_references: { en: 'Tafsir References', ar: 'مراجع التفسير', fr: 'Références du Tafsir', id: 'Referensi Tafsir', ur: 'تفسیر کے حوالے', bn: 'তাফসীর রেফারেন্স', tr: 'Tefsir Referansları', fa: 'منابع تفسیری', sw: 'Marejeo ya Tafsiri', ru: 'Ссылки на Тафсир', ha: 'Manazartar Tafsiri', ber: 'Tizmilin n Tefsir', zh: '经注参考', ms: 'Rujukan Tafsir', am: 'የተፍሲር ማጣቀሻዎች' },
        hadith_references: { en: 'Hadith References', ar: 'مراجع الحديث', fr: 'Références du Hadith', id: 'Referensi Hadis', ur: 'حدیث کے حوالے', bn: 'হাদিস রেফারেন্স', tr: 'Hadis Referansları', fa: 'منابع حدیثی', sw: 'Marejeo ya Hadithi', ru: 'Ссылки на Хадисы', ha: 'Manazartar Hadisi', ber: 'Tizmilin n Lḥadit', zh: '圣训参考', ms: 'Rujukan Hadis', am: 'የሐዲስ ማጣቀሻዎች' },
        dhikr_prescriptions: { en: 'Dhikr Prescriptions', ar: 'وصفات الذكر', fr: 'Prescriptions de Dhikr', id: 'Resep Zikir', ur: 'ذکر کے نسخے', bn: 'যিকিরের প্রেসক্রিপশন', tr: 'Zikir Reçeteleri', fa: 'تجویزهای ذکر', sw: 'Maagizo ya Dhikr', ru: 'Предписания для Зикра', ha: 'Umarnin Zikiri', ber: 'Tiwsefin n Dhikr', zh: '赞念处方', ms: 'Preskripsi Zikir', am: 'የዚክር ማዘዣዎች' },
        root_derivatives: { en: 'Root Derivatives', ar: 'مشتقات الجذر', fr: 'Dérivés de la racine', id: 'Turunan Akar Kata', ur: 'جڑ کے مشتقات', bn: 'মূল থেকে উদ্ভূত', tr: 'Kök Türevleri', fa: 'مشتقات ریشه', sw: 'Mizizi ya Maneno', ru: 'Производные от корня', ha: 'Asalin Kalma', ber: 'Isekkilen n uẓar', zh: '词根派生', ms: 'Terbitan Akar', am: 'የስርወ-ቃል ውጤቶች' },
        occurrences: { en: 'Occurrences in the Qur\'an', ar: 'الورود في القرآن', fr: 'Occurrences dans le Coran', id: 'Kemunculan dalam Al-Qur\'an', ur: 'قرآن میں تذکرہ', bn: 'কুরআনে উল্লেখ', tr: 'Kur\'an\'da Geçtiği Yerler', fa: 'موارد ذکر در قرآن', sw: 'Kutajwa katika Qur\'an', ru: 'Упоминания в Коране', ha: 'Bayyanarwa a cikin Alkur\'ani', ber: 'Tidyanin deg Leqran', zh: '古兰经中的出现次数', ms: 'Kemunculan dalam Al-Quran', am: 'በቁርኣን ውስጥ የተጠቀሱበት' },
        classical_poetic_citation: { en: 'Classical Poetic Citation', ar: 'استشهاد شعري كلاسيكي', fr: 'Citation poétique classique', id: 'Kutipan Puitis Klasik', ur: 'کلاسیکی شاعرانہ حوالہ', bn: 'শাস্ত্রীয় কাব্যিক উদ্ধৃতি', tr: 'Klasik Şiirsel Alıntı', fa: 'نقل قول شاعرانه کلاسیک', sw: 'Nukuu ya Ushairi wa Kale', ru: 'Классическая поэтическая цитата', ha: 'Misalin Waƙar gargajiya', ber: 'Asefru aklasik', zh: '古典诗词引用', ms: 'Petikan Puitis Klasik', am: 'ክላሲካል የግጥም ጥቅስ' },
        fiqh_applications: { en: 'Fiqh Applications', ar: 'تطبيقات فقهية', fr: 'Applications du Fiqh', id: 'Aplikasi Fiqih', ur: 'فقہی اطلاقات', bn: 'ফিকহি প্রয়োগ', tr: 'Fıkıh Uygulamaları', fa: 'کاربردهای فقهی', sw: 'Matumizi ya Fiqhi', ru: 'Применения в фикхе', ha: 'Ayyukan Fiqihu', ber: 'Isnasen n Fiqh', zh: '教法应用', ms: 'Aplikasi Fiqh', am: 'የፊቅህ አተገባበር' },
        liturgical_usage: { en: 'Liturgical Usage', ar: 'الاستخدام التعبدي', fr: 'Usage liturgique', id: 'Penggunaan Liturgis', ur: 'عبادتی استعمال', bn: 'ধর্মানুষ্ঠানিক ব্যবহার', tr: 'Liturjik Kullanım', fa: 'کاربرد عبادی', sw: 'Matumizi ya Kiliturujia', ru: 'Литургическое использование', ha: 'Amfani a Ibada', ber: 'Asemres n Tẓallit', zh: '礼仪用途', ms: 'Penggunaan Liturgi', am: 'የአምልኮ አጠቃቀም' }
    };

    function getLanguageName(code) {
        const langMap = {
            'ar': 'العربية (Arabic)', 'en': 'English', 'fr': 'Français', 'id': 'Indonesian',
            'ur': 'اردو (Urdu)', 'bn': 'বাংলা (Bengali)', 'tr': 'Türkçe', 'fa': 'فارسی (Persian)',
            'sw': 'Swahili', 'ha': 'Hausa', 'ber': 'Berber', 'zh': '中文 (Chinese)',
            'ms': 'Malay', 'am': 'አማርኛ (Amharic)', 'ru': 'Русский (Russian)'
        };
        return langMap[code] || code.toUpperCase();
    }

    function createNameCard(name) {
        const card = document.createElement('div');
        card.className = 'glass-card';

        const languageOptions = Object.keys(name.explanations || { 'en': {} })
            .sort((a, b) => a === 'en' ? -1 : 1)
            .map(lang => `<option value="${lang}">${getLanguageName(lang)}</option>`)
            .join('');

        // --- UPDATED HTML: REMOVED THE MEANING DIV ---
        card.innerHTML = `
            <div class="name-row">
                <div class="arabic-name">${name.name.ar || ''}</div>
                <div class="info">
                    <div class="transliteration">${name.transliteration.en || ''}</div>
                </div>
                <button class="expand-btn" title="Show Details"><span>&#x25BC;</span></button>
            </div>
            <div class="details" style="display: none;">
                <div class="control-group">
                    <label for="lang-select-${name.id}" id="details-lang-label-${name.id}"></label>
                    <select id="lang-select-${name.id}" class="lang-selector">${languageOptions}</select>
                </div>
                <div class="details-content" id="details-content-${name.id}"></div>
            </div>
        `;

        const langSelect = card.querySelector(`#lang-select-${name.id}`);
        const detailsContentDiv = card.querySelector(`#details-content-${name.id}`);
        const detailsLangLabel = card.querySelector(`#details-lang-label-${name.id}`);

        function updateContentForLanguage() {
            const lang = langSelect.value || 'en';
            const isRTL = ['ar', 'fa', 'ur'].includes(lang);
            let detailsHTML = '';

            const getTranslation = (field) => (field && (field[lang] || field['en'])) || null;
            const getUiTranslation = (key) => uiTranslations[key]?.[lang] || uiTranslations[key]?.en;

            detailsLangLabel.textContent = `${getUiTranslation('details_language')}:`;

            const addSection = (titleKey, content) => {
                if (content && content.trim() !== '') {
                    const title = getUiTranslation(titleKey);
                    detailsHTML += `<div class="details-title">${title}</div><div class="details-text">${content}</div>`;
                }
            };

            const addSimpleSection = (titleKey, valueKey) => {
                 const value = getTranslation(name[valueKey]);
                 if(value) {
                    const title = getUiTranslation(titleKey);
                    detailsHTML += `<div class="details-title">${title}</div><div class="details-text">${value}</div>`;
                 }
            };

            // --- REMOVED THE MEANING SNIPPET LOGIC ---

            addSimpleSection('category', 'category');
            addSimpleSection('root', 'root');

            const explanationsForLang = name.explanations?.[lang] || name.explanations?.en;
            if (explanationsForLang) {
                let content = Object.entries(explanationsForLang)
                    .map(([source, text]) => `<p><strong>${source}:</strong> ${text}</p>`)
                    .join('');
                addSection('explanations', content);
            }

            addSection('invocation', getTranslation(name.invocation));
            addSection('use_case', getTranslation(name.use_case));

            if (name.advanced) {
                const adv = name.advanced;
                if (adv.tafsir_references?.length) {
                    let content = adv.tafsir_references.map(ref => `<p><strong>${getTranslation(ref.verse)}:</strong> ${getTranslation(ref.commentary)}</p>`).join('');
                    addSection('tafsir_references', content);
                }
                if (adv.hadith_references?.length) {
                    let content = adv.hadith_references.map(ref => `<p><strong>${getTranslation(ref.source)} ${ref.hadith_number || ''}:</strong> ${getTranslation(ref.text)}</p>`).join('');
                    addSection('hadith_references', content);
                }
                if (adv.dhikr_prescriptions?.length) {
                    let content = adv.dhikr_prescriptions.map(p => `<p><strong>${getTranslation(p.practice)}:</strong> ${getTranslation(p.text)}</p>`).join('');
                    addSection('dhikr_prescriptions', content);
                }
                if (adv.root_derivatives?.length) {
                    let content = '<ul>' + adv.root_derivatives.map(d => `<li><strong>${getTranslation(d.derivative)}:</strong> ${getTranslation(d.meaning)}</li>`).join('') + '</ul>';
                    addSection('root_derivatives', content);
                }
                if (adv.occurrences?.length) {
                    let content = '<ul>' + adv.occurrences.map(o => `<li>${getTranslation(o.verse)}</li>`).join('') + '</ul>';
                    addSection('occurrences', content);
                }
                if (adv.classical_poetic_citation) {
                    const citation = adv.classical_poetic_citation;
                    let content = `<p><em>"${getTranslation(citation.text)}"</em><br>— ${getTranslation(citation.author)}</p>`;
                    addSection('classical_poetic_citation', content);
                }
                addSection('fiqh_applications', getTranslation(adv.fiqh_applications));
                addSection('liturgical_usage', getTranslation(adv.liturgical_usage));
            }

            detailsContentDiv.innerHTML = detailsHTML || '<p>Details are not available in this language.</p>';
            detailsContentDiv.dir = isRTL ? 'rtl' : 'ltr';
        }

        langSelect.addEventListener('change', updateContentForLanguage);
        card.querySelector('.name-row').addEventListener('click', () => {
            const details = card.querySelector('.details');
            const isExpanded = card.classList.toggle('expanded');
            details.style.display = isExpanded ? 'block' : 'none';
            card.querySelector('.expand-btn span').innerHTML = isExpanded ? '&#x25B2;' : '&#x25BC;';
        });

        updateContentForLanguage();
        return card;
    }

    async function fetchDataAndRender() {
        try {
            const response = await fetch('/api/names');
            if (!response.ok) throw new Error(`Network error: ${response.statusText}`);
            allNamesData = await response.json();
            if (loadingMessage) loadingMessage.style.display = 'none';
            renderFilteredNames();
        } catch (error) {
            if (loadingMessage) {
                loadingMessage.style.color = 'red';
                loadingMessage.textContent = `Failed to load data. ${error.message}`;
            }
        }
    }

    function renderFilteredNames() {
        const filter = searchInput.value.trim().toLowerCase();
        const filteredData = allNamesData.filter(n => {
            if (!filter) return true;
            const nameMatch = Object.values(n.name || {}).some(val => typeof val === 'string' && val.toLowerCase().includes(filter));
            const translitMatch = Object.values(n.transliteration || {}).some(val => typeof val === 'string' && val.toLowerCase().includes(filter));
            return nameMatch || translitMatch;
        });

        namesListContainer.innerHTML = '';
        if (filteredData.length > 0) {
            filteredData.forEach(name => namesListContainer.appendChild(createNameCard(name)));
        } else {
            namesListContainer.innerHTML = `<div style="color:#fff7; text-align:center; padding: 20px;">No names found.</div>`;
        }
    }

    searchInput.addEventListener('input', renderFilteredNames);
    fetchDataAndRender();
});
