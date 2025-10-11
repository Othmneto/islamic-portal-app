/**
 * Islamic Terminology Service
 * Provides consistent translation of Islamic terms across all languages
 * Ensures accuracy and maintains religious context
 */

class IslamicTerminologyService {
    constructor() {
        this.terminology = this.initializeTerminology();
        this.contextRules = this.initializeContextRules();
        this.languageMappings = this.initializeLanguageMappings();
    }

    /**
     * Initialize comprehensive Islamic terminology database
     */
    initializeTerminology() {
        return {
            // Core Islamic Concepts
            'الله': {
                'en': 'Allah',
                'fr': 'Allah',
                'es': 'Alá',
                'de': 'Allah',
                'tr': 'Allah',
                'ur': 'اللہ',
                'hi': 'अल्लाह',
                'bn': 'আল্লাহ',
                'id': 'Allah',
                'ms': 'Allah',
                'sw': 'Mungu',
                'zh': '安拉',
                'ru': 'Аллах',
                'fa': 'الله'
            },
            'السلام عليكم': {
                'en': 'Peace be upon you',
                'fr': 'Que la paix soit sur vous',
                'es': 'La paz sea contigo',
                'de': 'Friede sei mit dir',
                'tr': 'Selamün aleyküm',
                'ur': 'السلام علیکم',
                'hi': 'आप पर शांति हो',
                'bn': 'আপনার উপর শান্তি বর্ষিত হোক',
                'id': 'Semoga damai menyertai Anda',
                'ms': 'Semoga damai menyertai Anda',
                'sw': 'Amani iwe juu yako',
                'zh': '愿平安与你同在',
                'ru': 'Мир вам',
                'fa': 'سلام علیکم'
            },
            'الصلاة': {
                'en': 'Prayer',
                'fr': 'Prière',
                'es': 'Oración',
                'de': 'Gebet',
                'tr': 'Namaz',
                'ur': 'نماز',
                'hi': 'नमाज़',
                'bn': 'নামাজ',
                'id': 'Shalat',
                'ms': 'Solat',
                'sw': 'Sala',
                'zh': '礼拜',
                'ru': 'Молитва',
                'fa': 'نماز'
            },
            'القرآن': {
                'en': 'Quran',
                'fr': 'Coran',
                'es': 'Corán',
                'de': 'Koran',
                'tr': 'Kuran',
                'ur': 'قرآن',
                'hi': 'कुरान',
                'bn': 'কুরআন',
                'id': 'Al-Quran',
                'ms': 'Al-Quran',
                'sw': 'Kurani',
                'zh': '古兰经',
                'ru': 'Коран',
                'fa': 'قرآن'
            },
            'الحديث': {
                'en': 'Hadith',
                'fr': 'Hadith',
                'es': 'Hadiz',
                'de': 'Hadith',
                'tr': 'Hadis',
                'ur': 'حدیث',
                'hi': 'हदीस',
                'bn': 'হাদিস',
                'id': 'Hadits',
                'ms': 'Hadis',
                'sw': 'Hadithi',
                'zh': '圣训',
                'ru': 'Хадис',
                'fa': 'حدیث'
            },
            'الزكاة': {
                'en': 'Zakat',
                'fr': 'Zakat',
                'es': 'Zakat',
                'de': 'Zakat',
                'tr': 'Zekat',
                'ur': 'زکات',
                'hi': 'ज़कात',
                'bn': 'যাকাত',
                'id': 'Zakat',
                'ms': 'Zakat',
                'sw': 'Zaka',
                'zh': '天课',
                'ru': 'Закят',
                'fa': 'زکات'
            },
            'الصوم': {
                'en': 'Fasting',
                'fr': 'Jeûne',
                'es': 'Ayuno',
                'de': 'Fasten',
                'tr': 'Oruç',
                'ur': 'روزہ',
                'hi': 'रोज़ा',
                'bn': 'রোজা',
                'id': 'Puasa',
                'ms': 'Puasa',
                'sw': 'Kufunga',
                'zh': '斋戒',
                'ru': 'Пост',
                'fa': 'روزه'
            },
            'الحج': {
                'en': 'Hajj',
                'fr': 'Hajj',
                'es': 'Hajj',
                'de': 'Hajj',
                'tr': 'Hac',
                'ur': 'حج',
                'hi': 'हज',
                'bn': 'হজ',
                'id': 'Haji',
                'ms': 'Haji',
                'sw': 'Hija',
                'zh': '朝觐',
                'ru': 'Хадж',
                'fa': 'حج'
            },
            'الشهادة': {
                'en': 'Testimony of Faith',
                'fr': 'Témoignage de foi',
                'es': 'Testimonio de fe',
                'de': 'Glaubenszeugnis',
                'tr': 'Kelime-i Şehadet',
                'ur': 'شہادت',
                'hi': 'ईमान की गवाही',
                'bn': 'ঈমানের সাক্ষ্য',
                'id': 'Syahadat',
                'ms': 'Syahadah',
                'sw': 'Shahada',
                'zh': '信仰证词',
                'ru': 'Свидетельство веры',
                'fa': 'شهادت'
            },
            'الجمعة': {
                'en': 'Friday',
                'fr': 'Vendredi',
                'es': 'Viernes',
                'de': 'Freitag',
                'tr': 'Cuma',
                'ur': 'جمعہ',
                'hi': 'शुक्रवार',
                'bn': 'শুক্রবার',
                'id': 'Jumat',
                'ms': 'Jumaat',
                'sw': 'Ijumaa',
                'zh': '星期五',
                'ru': 'Пятница',
                'fa': 'جمعه'
            },
            'الخطبة': {
                'en': 'Sermon',
                'fr': 'Sermon',
                'es': 'Sermón',
                'de': 'Predigt',
                'tr': 'Hutbe',
                'ur': 'خطبہ',
                'hi': 'खुत्बा',
                'bn': 'খুতবা',
                'id': 'Khutbah',
                'ms': 'Khutbah',
                'sw': 'Khutba',
                'zh': '讲道',
                'ru': 'Проповедь',
                'fa': 'خطبه'
            },
            'المسجد': {
                'en': 'Mosque',
                'fr': 'Mosquée',
                'es': 'Mezquita',
                'de': 'Moschee',
                'tr': 'Cami',
                'ur': 'مسجد',
                'hi': 'मस्जिद',
                'bn': 'মসজিদ',
                'id': 'Masjid',
                'ms': 'Masjid',
                'sw': 'Msikiti',
                'zh': '清真寺',
                'ru': 'Мечеть',
                'fa': 'مسجد'
            },
            'الإمام': {
                'en': 'Imam',
                'fr': 'Imam',
                'es': 'Imam',
                'de': 'Imam',
                'tr': 'İmam',
                'ur': 'امام',
                'hi': 'इमाम',
                'bn': 'ইমাম',
                'id': 'Imam',
                'ms': 'Imam',
                'sw': 'Imam',
                'zh': '伊玛目',
                'ru': 'Имам',
                'fa': 'امام'
            },
            'المؤذن': {
                'en': 'Muezzin',
                'fr': 'Muezzin',
                'es': 'Muecín',
                'de': 'Muezzin',
                'tr': 'Müezzin',
                'ur': 'موذن',
                'hi': 'मुअज़्ज़िन',
                'bn': 'মুয়াজ্জিন',
                'id': 'Muadzin',
                'ms': 'Bilal',
                'sw': 'Muezzin',
                'zh': '宣礼员',
                'ru': 'Муэдзин',
                'fa': 'موذن'
            },
            'الأذان': {
                'en': 'Adhan',
                'fr': 'Adhan',
                'es': 'Adhan',
                'de': 'Adhan',
                'tr': 'Ezan',
                'ur': 'اذان',
                'hi': 'अज़ान',
                'bn': 'আজান',
                'id': 'Adzan',
                'ms': 'Azan',
                'sw': 'Adhan',
                'zh': '宣礼',
                'ru': 'Азан',
                'fa': 'اذان'
            },
            'الركوع': {
                'en': 'Ruku',
                'fr': 'Ruku',
                'es': 'Ruku',
                'de': 'Ruku',
                'tr': 'Rüku',
                'ur': 'رکوع',
                'hi': 'रुकू',
                'bn': 'রুকু',
                'id': 'Ruku',
                'ms': 'Ruku',
                'sw': 'Ruku',
                'zh': '鞠躬',
                'ru': 'Руку',
                'fa': 'رکوع'
            },
            'السجود': {
                'en': 'Sujood',
                'fr': 'Sujood',
                'es': 'Sujood',
                'de': 'Sujood',
                'tr': 'Secde',
                'ur': 'سجود',
                'hi': 'सजदा',
                'bn': 'সিজদা',
                'id': 'Sujud',
                'ms': 'Sujud',
                'sw': 'Sujud',
                'zh': '叩头',
                'ru': 'Суджуд',
                'fa': 'سجود'
            },
            'التشهد': {
                'en': 'Tashahhud',
                'fr': 'Tashahhud',
                'es': 'Tashahhud',
                'de': 'Tashahhud',
                'tr': 'Teşehhüd',
                'ur': 'تشہد',
                'hi': 'तशहहुद',
                'bn': 'তাশাহহুদ',
                'id': 'Tasyahud',
                'ms': 'Tasyahud',
                'sw': 'Tashahhud',
                'zh': '坐念',
                'ru': 'Ташаххуд',
                'fa': 'تشهد'
            },
            'الفاتحة': {
                'en': 'Al-Fatiha',
                'fr': 'Al-Fatiha',
                'es': 'Al-Fatiha',
                'de': 'Al-Fatiha',
                'tr': 'Fatiha',
                'ur': 'فاتحہ',
                'hi': 'अल-फातिहा',
                'bn': 'আল-ফাতিহা',
                'id': 'Al-Fatihah',
                'ms': 'Al-Fatihah',
                'sw': 'Al-Fatiha',
                'zh': '开端章',
                'ru': 'Аль-Фатиха',
                'fa': 'فاتحه'
            },
            'آمين': {
                'en': 'Ameen',
                'fr': 'Amin',
                'es': 'Amén',
                'de': 'Amen',
                'tr': 'Amin',
                'ur': 'آمین',
                'hi': 'आमीन',
                'bn': 'আমীন',
                'id': 'Amin',
                'ms': 'Amin',
                'sw': 'Amin',
                'zh': '阿敏',
                'ru': 'Амин',
                'fa': 'آمین'
            },
            'بسم الله': {
                'en': 'In the name of Allah',
                'fr': 'Au nom d\'Allah',
                'es': 'En el nombre de Alá',
                'de': 'Im Namen Allahs',
                'tr': 'Allah\'ın adıyla',
                'ur': 'اللہ کے نام سے',
                'hi': 'अल्लाह के नाम से',
                'bn': 'আল্লাহর নামে',
                'id': 'Dengan nama Allah',
                'ms': 'Dengan nama Allah',
                'sw': 'Kwa jina la Mungu',
                'zh': '以安拉之名',
                'ru': 'Во имя Аллаха',
                'fa': 'به نام خدا'
            },
            'الحمد لله': {
                'en': 'Praise be to Allah',
                'fr': 'Louange à Allah',
                'es': 'Alabado sea Alá',
                'de': 'Lob sei Allah',
                'tr': 'Allah\'a hamd olsun',
                'ur': 'اللہ کا شکر',
                'hi': 'अल्लाह की प्रशंसा',
                'bn': 'আল্লাহর প্রশংসা',
                'id': 'Segala puji bagi Allah',
                'ms': 'Segala puji bagi Allah',
                'sw': 'Sifa zote ni za Mungu',
                'zh': '赞美安拉',
                'ru': 'Хвала Аллаху',
                'fa': 'حمد خدا'
            },
            'سبحان الله': {
                'en': 'Glory be to Allah',
                'fr': 'Gloire à Allah',
                'es': 'Gloria a Alá',
                'de': 'Preis sei Allah',
                'tr': 'Allah\'ı tenzih ederim',
                'ur': 'اللہ پاک ہے',
                'hi': 'अल्लाह महान है',
                'bn': 'আল্লাহ পবিত্র',
                'id': 'Maha Suci Allah',
                'ms': 'Maha Suci Allah',
                'sw': 'Mtukufu Mungu',
                'zh': '赞美安拉',
                'ru': 'Слава Аллаху',
                'fa': 'سبحان الله'
            },
            'الله أكبر': {
                'en': 'Allah is the Greatest',
                'fr': 'Allah est le Plus Grand',
                'es': 'Alá es el Más Grande',
                'de': 'Allah ist der Größte',
                'tr': 'Allah en büyüktür',
                'ur': 'اللہ سب سے بڑا ہے',
                'hi': 'अल्लाह सबसे बड़ा है',
                'bn': 'আল্লাহ সবচেয়ে বড়',
                'id': 'Allah Maha Besar',
                'ms': 'Allah Maha Besar',
                'sw': 'Mungu ni Mkuu',
                'zh': '安拉至大',
                'ru': 'Аллах велик',
                'fa': 'الله اکبر'
            },
            'لا إله إلا الله': {
                'en': 'There is no god but Allah',
                'fr': 'Il n\'y a de dieu qu\'Allah',
                'es': 'No hay más dios que Alá',
                'de': 'Es gibt keinen Gott außer Allah',
                'tr': 'Allah\'tan başka ilah yoktur',
                'ur': 'اللہ کے سوا کوئی معبود نہیں',
                'hi': 'अल्लाह के अलावा कोई पूज्य नहीं',
                'bn': 'আল্লাহ ছাড়া কোন উপাস্য নেই',
                'id': 'Tidak ada tuhan selain Allah',
                'ms': 'Tiada tuhan melainkan Allah',
                'sw': 'Hakuna mungu ila Mungu',
                'zh': '除安拉外别无他神',
                'ru': 'Нет бога кроме Аллаха',
                'fa': 'لا اله الا الله'
            },
            'محمد رسول الله': {
                'en': 'Muhammad is the Messenger of Allah',
                'fr': 'Muhammad est le Messager d\'Allah',
                'es': 'Mahoma es el Mensajero de Alá',
                'de': 'Muhammad ist der Gesandte Allahs',
                'tr': 'Muhammed Allah\'ın elçisidir',
                'ur': 'محمد اللہ کے رسول ہیں',
                'hi': 'मुहम्मद अल्लाह के रसूल हैं',
                'bn': 'মুহাম্মদ আল্লাহর রাসূল',
                'id': 'Muhammad adalah utusan Allah',
                'ms': 'Muhammad adalah utusan Allah',
                'sw': 'Muhammad ni mtume wa Mungu',
                'zh': '穆罕默德是安拉的使者',
                'ru': 'Мухаммад - посланник Аллаха',
                'fa': 'محمد رسول الله'
            },
            'الرحمن الرحيم': {
                'en': 'The Most Gracious, The Most Merciful',
                'fr': 'Le Tout Miséricordieux, Le Très Miséricordieux',
                'es': 'El Clemente, El Misericordioso',
                'de': 'Der Allerbarmer, Der Barmherzige',
                'tr': 'Rahman ve Rahim',
                'ur': 'رحمن اور رحیم',
                'hi': 'रहमान और रहीम',
                'bn': 'রহমান ও রহীম',
                'id': 'Yang Maha Pengasih, Maha Penyayang',
                'ms': 'Yang Maha Pengasih, Maha Penyayang',
                'sw': 'Mwingi wa rehema, Mwenye rehema',
                'zh': '至仁至慈',
                'ru': 'Милостивый, Милосердный',
                'fa': 'الرحمن الرحیم'
            },
            'مالك يوم الدين': {
                'en': 'Master of the Day of Judgment',
                'fr': 'Maître du Jour du Jugement',
                'es': 'Dueño del Día del Juicio',
                'de': 'Herr des Tages des Gerichts',
                'tr': 'Din gününün sahibi',
                'ur': 'قیامت کے دن کا مالک',
                'hi': 'प्रलय के दिन का स्वामी',
                'bn': 'বিচার দিবসের মালিক',
                'id': 'Pemilik hari pembalasan',
                'ms': 'Pemilik hari pembalasan',
                'sw': 'Mwenyi siku ya malipo',
                'zh': '报应日的主',
                'ru': 'Владыка Дня воздаяния',
                'fa': 'مالک یوم الدین'
            },
            'إياك نعبد وإياك نستعين': {
                'en': 'You alone we worship, and You alone we ask for help',
                'fr': 'C\'est Toi que nous adorons, et c\'est Toi dont nous implorons secours',
                'es': 'Solo a Ti adoramos y solo a Ti pedimos ayuda',
                'de': 'Dir allein dienen wir, und Dich allein bitten wir um Hilfe',
                'tr': 'Yalnız sana kulluk ederiz ve yalnız senden yardım dileriz',
                'ur': 'ہم صرف تیری عبادت کرتے ہیں اور صرف تجھ سے مدد مانگتے ہیں',
                'hi': 'हम केवल तेरी ही पूजा करते हैं और केवल तुझसे ही मदद मांगते हैं',
                'bn': 'আমরা শুধু তোমারই ইবাদত করি এবং শুধু তোমারই কাছে সাহায্য চাই',
                'id': 'Hanya kepada Engkaulah kami menyembah dan hanya kepada Engkaulah kami mohon pertolongan',
                'ms': 'Hanya kepada Engkaulah kami menyembah dan hanya kepada Engkaulah kami mohon pertolongan',
                'sw': 'Wewe tu tunakuabudu na wewe tu tunakuomba msaada',
                'zh': '我们只崇拜你，只求你佑助',
                'ru': 'Тебе одному мы поклоняемся и Тебя одного молим о помощи',
                'fa': 'ایاک نعبد و ایاک نستعین'
            },
            'اهدنا الصراط المستقيم': {
                'en': 'Guide us to the straight path',
                'fr': 'Guide-nous dans le droit chemin',
                'es': 'Guíanos por el sendero recto',
                'de': 'Führe uns den geraden Weg',
                'tr': 'Bizi doğru yola ilet',
                'ur': 'ہمیں سیدھے راستے کی ہدایت دے',
                'hi': 'हमें सीधे मार्ग की ओर ले चल',
                'bn': 'আমাদেরকে সরল পথ দেখাও',
                'id': 'Tunjukilah kami jalan yang lurus',
                'ms': 'Tunjukilah kami jalan yang lurus',
                'sw': 'Tuongozee njia ya sawa',
                'zh': '求你引导我们上正路',
                'ru': 'Веди нас прямым путем',
                'fa': 'اهدنا الصراط المستقیم'
            },
            'صراط الذين أنعمت عليهم': {
                'en': 'The path of those upon whom You have bestowed favor',
                'fr': 'Le chemin de ceux que Tu as comblés de faveurs',
                'es': 'El sendero de los que has favorecido',
                'de': 'Den Weg derer, denen Du Gnade erwiesen hast',
                'tr': 'Kendilerine nimet verdiğin kimselerin yolu',
                'ur': 'ان لوگوں کا راستہ جن پر تو نے انعام کیا',
                'hi': 'उन लोगों का मार्ग जिन पर तूने अनुग्रह किया',
                'bn': 'যাদের প্রতি তুমি অনুগ্রহ করেছ তাদের পথ',
                'id': 'Jalan orang-orang yang telah Engkau beri nikmat',
                'ms': 'Jalan orang-orang yang telah Engkau beri nikmat',
                'sw': 'Njia ya wale uliowafanyia wema',
                'zh': '你所佑助者的路',
                'ru': 'Путь тех, кому Ты оказал милость',
                'fa': 'صراط الذین انعمت علیهم'
            },
            'غير المغضوب عليهم ولا الضالين': {
                'en': 'Not of those who have evoked anger or of those who are astray',
                'fr': 'Non pas de ceux qui ont encouru Ta colère, ni des égarés',
                'es': 'No de los que han incurrido en ira, ni de los extraviados',
                'de': 'Nicht derer, die Deinen Zorn erregt haben, noch der Irrenden',
                'tr': 'Gazaba uğrayanların ve sapıtanların yolu değil',
                'ur': 'نہ ان لوگوں کا جن پر غضب ہوا اور نہ گمراہوں کا',
                'hi': 'न उन लोगों का जिन पर क्रोध हुआ और न गुमराहों का',
                'bn': 'যাদের প্রতি গজব হয়েছে এবং যারা পথভ্রষ্ট',
                'id': 'Bukan jalan orang-orang yang dimurkai dan bukan pula jalan orang-orang yang sesat',
                'ms': 'Bukan jalan orang-orang yang dimurkai dan bukan pula jalan orang-orang yang sesat',
                'sw': 'Si wale walio kasirikiwa wala wapotovu',
                'zh': '不是受谴怒者的路，也不是迷误者的路',
                'ru': 'Не тех, на кого пал гнев, и не заблудших',
                'fa': 'غیر المغضوب علیهم ولا الضالین'
            }
        };
    }

    /**
     * Initialize context rules for better translation accuracy
     */
    initializeContextRules() {
        return {
            'financial': {
                'الزكاة': 'Charitable giving',
                'الصدقة': 'Charity',
                'الربا': 'Interest/Usury'
            },
            'spiritual': {
                'الزكاة': 'Purification of wealth',
                'الصدقة': 'Voluntary charity',
                'الربا': 'Prohibited interest'
            },
            'prayer': {
                'الركوع': 'Bowing in prayer',
                'السجود': 'Prostration in prayer',
                'التشهد': 'Sitting position in prayer'
            },
            'general': {
                'الركوع': 'Bowing',
                'السجود': 'Prostration',
                'التشهد': 'Testimony'
            }
        };
    }

    /**
     * Initialize language code mappings
     */
    initializeLanguageMappings() {
        return {
            'en': 'en',
            'english': 'en',
            'fr': 'fr',
            'french': 'fr',
            'français': 'fr',
            'es': 'es',
            'spanish': 'es',
            'español': 'es',
            'de': 'de',
            'german': 'de',
            'deutsch': 'de',
            'tr': 'tr',
            'turkish': 'tr',
            'türkçe': 'tr',
            'ur': 'ur',
            'urdu': 'ur',
            'اردو': 'ur',
            'hi': 'hi',
            'hindi': 'hi',
            'हिन्दी': 'hi',
            'bn': 'bn',
            'bengali': 'bn',
            'বাংলা': 'bn',
            'id': 'id',
            'indonesian': 'id',
            'bahasa': 'id',
            'ms': 'ms',
            'malay': 'ms',
            'bahasa melayu': 'ms',
            'sw': 'sw',
            'swahili': 'sw',
            'kiswahili': 'sw',
            'zh': 'zh',
            'chinese': 'zh',
            '中文': 'zh',
            'ru': 'ru',
            'russian': 'ru',
            'русский': 'ru',
            'fa': 'fa',
            'persian': 'fa',
            'فارسی': 'fa'
        };
    }

    /**
     * Get proper translation for Islamic term
     * @param {string} arabicTerm - Arabic term to translate
     * @param {string} targetLanguage - Target language code
     * @param {string} context - Context for better accuracy
     * @returns {string|null} Proper translation or null if not found
     */
    getTranslation(arabicTerm, targetLanguage, context = 'general') {
        try {
            // Normalize the Arabic term
            const normalizedTerm = this.normalizeArabicText(arabicTerm);
            
            // Get base translation
            const termData = this.terminology[normalizedTerm];
            if (!termData) {
                return null;
            }

            // Normalize target language
            const normalizedLang = this.languageMappings[targetLanguage.toLowerCase()] || targetLanguage.toLowerCase();
            
            // Get translation
            let translation = termData[normalizedLang];
            
            // Apply context rules if available
            if (this.contextRules[context] && this.contextRules[context][normalizedTerm]) {
                translation = this.contextRules[context][normalizedTerm];
            }

            return translation || null;
        } catch (error) {
            console.error('[IslamicTerminologyService] Error getting translation:', error);
            return null;
        }
    }

    /**
     * Check if text contains Islamic terms that need special handling
     * @param {string} text - Text to check
     * @returns {Array} Array of found Islamic terms
     */
    findIslamicTerms(text) {
        const foundTerms = [];
        const normalizedText = this.normalizeArabicText(text);
        
        for (const term in this.terminology) {
            if (normalizedText.includes(term)) {
                foundTerms.push({
                    term: term,
                    position: normalizedText.indexOf(term),
                    length: term.length
                });
            }
        }
        
        return foundTerms;
    }

    /**
     * Replace Islamic terms in text with proper translations
     * @param {string} text - Original text
     * @param {string} targetLanguage - Target language
     * @param {string} context - Context for translation
     * @returns {string} Text with Islamic terms replaced
     */
    replaceIslamicTerms(text, targetLanguage, context = 'general') {
        try {
            let processedText = text;
            const foundTerms = this.findIslamicTerms(text);
            
            // Sort by position (reverse order to avoid index shifting)
            foundTerms.sort((a, b) => b.position - a.position);
            
            for (const termInfo of foundTerms) {
                const translation = this.getTranslation(termInfo.term, targetLanguage, context);
                if (translation) {
                    const before = processedText.substring(0, termInfo.position);
                    const after = processedText.substring(termInfo.position + termInfo.length);
                    processedText = before + translation + after;
                }
            }
            
            return processedText;
        } catch (error) {
            console.error('[IslamicTerminologyService] Error replacing terms:', error);
            return text;
        }
    }

    /**
     * Normalize Arabic text for better matching
     * @param {string} text - Arabic text to normalize
     * @returns {string} Normalized text
     */
    normalizeArabicText(text) {
        return text
            .replace(/[ً-ٟ]/g, '') // Remove diacritics
            .replace(/[إأآ]/g, 'ا') // Normalize alef variations
            .replace(/[ة]/g, 'ه') // Normalize ta marbuta
            .replace(/[ي]/g, 'ي') // Normalize ya
            .trim();
    }

    /**
     * Get confidence score for Islamic term translation
     * @param {string} arabicTerm - Arabic term
     * @param {string} targetLanguage - Target language
     * @returns {number} Confidence score (0-1)
     */
    getConfidenceScore(arabicTerm, targetLanguage) {
        const normalizedTerm = this.normalizeArabicText(arabicTerm);
        const termData = this.terminology[normalizedTerm];
        
        if (!termData) {
            return 0;
        }
        
        const normalizedLang = this.languageMappings[targetLanguage.toLowerCase()] || targetLanguage.toLowerCase();
        const hasTranslation = !!termData[normalizedLang];
        
        return hasTranslation ? 1.0 : 0.5;
    }

    /**
     * Get all available languages for a term
     * @param {string} arabicTerm - Arabic term
     * @returns {Array} Array of available language codes
     */
    getAvailableLanguages(arabicTerm) {
        const normalizedTerm = this.normalizeArabicText(arabicTerm);
        const termData = this.terminology[normalizedTerm];
        
        if (!termData) {
            return [];
        }
        
        return Object.keys(termData);
    }

    /**
     * Add custom Islamic term to database
     * @param {string} arabicTerm - Arabic term
     * @param {Object} translations - Translations object {lang: translation}
     */
    addCustomTerm(arabicTerm, translations) {
        const normalizedTerm = this.normalizeArabicText(arabicTerm);
        this.terminology[normalizedTerm] = translations;
    }

    /**
     * Get statistics about the terminology database
     * @returns {Object} Database statistics
     */
    getStatistics() {
        try {
            console.log('📊 [IslamicTerminologyService] Getting database statistics...');
            
            const totalTerms = Object.keys(this.terminology).length;
            const allLanguages = new Set();
            
            for (const term in this.terminology) {
                Object.keys(this.terminology[term]).forEach(lang => allLanguages.add(lang));
            }
            
            const stats = {
                totalTerms,
                supportedLanguages: Array.from(allLanguages),
                totalTranslations: Object.values(this.terminology).reduce((sum, term) => sum + Object.keys(term).length, 0)
            };
            
            console.log('✅ [IslamicTerminologyService] Statistics retrieved:', stats);
            return stats;
        } catch (error) {
            console.error('❌ [IslamicTerminologyService] Error getting statistics:', error);
            return {
                totalTerms: 0,
                supportedLanguages: [],
                totalTranslations: 0,
                error: error.message
            };
        }
    }

    /**
     * Get all terms in the database
     * @returns {Array} Array of all terms with their translations
     */
    getAllTerms() {
        try {
            console.log('📚 [IslamicTerminologyService] Getting all terms...');
            
            const allTerms = Object.entries(this.terminology).map(([key, term]) => ({
                id: key,
                arabic: term.arabic || key,
                category: term.category || 'General',
                translations: term.translations || term,
                source: term.source || 'Islamic Terminology Database',
                lastUpdated: term.lastUpdated || new Date().toISOString()
            }));
            
            console.log('✅ [IslamicTerminologyService] Retrieved', allTerms.length, 'terms');
            return allTerms;
            
        } catch (error) {
            console.error('❌ [IslamicTerminologyService] Error getting all terms:', error);
            return [];
        }
    }
}

module.exports = IslamicTerminologyService;
