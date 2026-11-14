// GENERADO por supabase/generar_ts.py desde ingesta/parser.py y ingesta/categorias.py. No editar a mano.
export const PATRONES: Record<string, string> = {
 "A": "compra en el comercio\\s+(?<c>.+?)\\s+con (?:tu|la) tarjeta(?: de [\\p{L}\\p{N}_]+)?\\s+terminaci[oó]n\\s*\\**\\s*(?<tj>\\d{3,4}).{0,40}?monto de\\s*\\$\\s*(?<m>[\\d,]+(?:\\.\\d{1,2})?)\\s*(?<mon>MXN|USD|EUR|MXP)?.{0,20}?El\\s+(?<f>\\d{2}/\\d{2}/\\d{4})(?:\\s+a las\\s+(?<h>\\d{1,2}:\\d{2}))?",
 "C": "terminaci[oó]n:?\\s*\\**\\s*(?<tj>\\d{3,4})\\s*\\.?\\s*Monto:\\s*\\$\\s*(?<m>[\\d,]+(?:\\.\\d{1,2})?)\\s*(?<mon>MXN|USD|EUR)?\\s*Comercio:\\s*(?<c>.+?)\\s+Fecha y hora:\\s*(?<f>\\d{2}/\\d{2}/\\d{4})\\s+(?<h>\\d{1,2}:\\d{2})",
 "C2": "cashback en tu Cuenta Santander\\s*(?<tj>\\d{3,4})\\s*\\$\\s*(?<m>[\\d,]+(?:\\.\\d{1,2})?)\\s*(?<mon>MXN|USD|EUR)?\\s*(?<c>.+?)\\s+(?<f>\\d{2}/\\d{2}/\\d{4})\\s+(?<h>\\d{1,2}:\\d{2})",
 "C3": "compra con tu tarjeta de [\\p{L}\\p{N}_]+ terminaci[oó]n:?\\s*\\**\\s*(?<tj>\\d{3,4})\\s+por\\s*\\$\\s*(?<m>[\\d,]+(?:\\.\\d{1,2})?)\\s*(?<mon>MXN|M\\.N\\.|USD|EUR)?\\s+en el comercio\\s+(?<c>.+?),?\\s+el\\s+(?<d>\\d{1,2}) de (?<mes>\\d{1,2}) del (?<a>\\d{4})(?:\\s+a las\\s+(?<h>\\d{1,2}:\\d{2}))?",
 "B": "compra por\\s*\\$\\s*(?<m>[\\d,]+(?:\\.\\d{1,2})?).{0,80}?terminaci[oó]n\\s*\\**\\s*(?<tj>\\d{3,4}).*?Establecimiento:\\s*(?<c>.+?)\\.\\s*Fecha:\\s*(?<f>\\d{2}/\\d{2}/\\d{4})",
 "D_MONTO": "\\$\\s*(?<m>[\\d,]+(?:\\.\\d{1,2})?)\\s*MXN",
 "D_FECHA": "(\\d{2}/\\d{2}/\\d{4})(?:\\s+(?:a las\\s+)?(\\d{1,2}:\\d{2}))?",
 "D_TJ": "terminaci[oó]n:?\\s*\\**\\s*(\\d{3,4})",
 "D_COMERCIO": "(?:comercio|establecimiento)[:\\s]+(.{3,60}?)\\s+(?:con tu|por un|Fecha|\\.|,)",
 "TRANSF": "transferencia de tu cuenta terminaci[oó]n\\s*(?<origen>\\d+)\\s+a la cuenta terminaci[oó]n\\s*(?<dest>\\d+)(?:\\s+en\\s+(?<banco>.+?))?\\s*\\.\\s*Detalles.*?Importe:\\s*\\$\\s*(?<m>[\\d,]+(?:\\.\\d{1,2})?)\\s*MX[NP]?.*?Fecha:\\s*(?<f>\\d{2}/\\d{2}/\\d{4})(?:\\s*Hora:\\s*(?<h>\\d{1,2}:\\d{2}))?(?:.*?Referencia:\\s*(?<ref>\\S+))?",
 "TRANSF_CONCEPTO": "Concepto(?: de pago)?:\\s*(.+?)\\s+(?:Referencia|Clave|¿No|Fecha)",
 "DEPOSITO": "abono por\\s*\\$\\s*(?<m>[\\d,]+(?:\\.\\d{1,2})?)\\s*MX[NP]?\\s*a tu cuenta terminaci[oó]n\\s*(?<cuenta>\\d+).*?Fecha:\\s*(?<f>\\d{2}/\\d{2}/\\d{4})(?:\\s*Hora:\\s*(?<h>\\d{1,2}:\\d{2}))?",
 "DEP_BANCO": "Banco emisor:\\s*(.+?)\\s+(?:Cuenta origen|Clave|Concepto)",
 "DEP_ORIGEN": "Cuenta origen:\\s*(\\d+)",
 "DEP_ORDENANTE": "(?:Ordenante|Nombre del ordenante|Remitente):\\s*(.+?)\\s+(?:Cuenta|Banco|Clave|Concepto)",
 "DEP_CONCEPTO": "Concepto de pago:\\s*(.+?)\\s+El dep[oó]sito",
 "RETIRO": "el\\s+(?<f>\\d{2}/\\d{2}/\\d{4})\\s+a las\\s+(?<h>\\d{1,2}:\\d{2})\\s*hrs\\.?\\s*se realiz[oó] un retiro de efectivo.*?cantidad de\\s*\\$\\s*(?<m>[\\d,]+(?:\\.\\d{1,2})?).*?cuenta terminaci[oó]n\\s*(?<cuenta>\\d+)"
};

export const REGLAS: [string, string][] = [
 [
  "NOVIBET|PLAYDOIT|CALIENTE|CODERE|BETCRIS|BET365|STRENDUS|WINPOT|BETWAY|1XBET|CASINO|YAJUEGO|JUEGAENLINEA",
  "apuestas"
 ],
 [
  "SPEI|TRANSFERENCIA|TRASPASO|PAGO\\s+INTERBANCARIO|CODI\\b",
  "transferencias"
 ],
 [
  "AIRBNB|BOOKING|EXPEDIA|HOTEL|HOSTAL|MARRIOTT|HILTON|FIESTA\\s+(?:AMERICANA|INN)|CITY\\s+EXPRESS|ONE\\s+HOTEL",
  "viajes"
 ],
 [
  "AIRWAYS|AIRLINES|AEROMEXICO|VOLARIS|VIVA\\s*AEROBUS|VIVAAEROBUS|AMERICAN\\s+AIR|UNITED\\s+AIR|DELTA\\s+AIR|AEROPUERTO",
  "viajes"
 ],
 [
  "NETFLIX|PRIME\\s+VIDEO|AMAZON\\s+PRIME|DISNEY|HBO|\\bMAX\\b|APPLE\\.COM|APPLE\\s+TV|ITUNES|PARAMOUNT|CRUNCHYROLL|BLIM\\b|VIX\\b",
  "suscripciones"
 ],
 [
  "SPOTIFY|DEEZER|APPLE\\s+MUSIC|YOUTUBE|GOOGLE\\s*\\*|AMAZON\\s+MUSIC",
  "suscripciones"
 ],
 [
  "CLAUDE\\.AI|ANTHROPIC|OPENAI|CHATGPT|COPILOT|GITHUB|CLOUDFLARE|MICROSOFT|ADOBE|CANVA|DROPBOX|ICLOUD",
  "suscripciones"
 ],
 [
  "TOTAL\\s*PASS|OVHCLOUD|PIMEYES|\\bGYM\\b|GIMNASIO|SMART\\s*FIT|SPORT\\s*CITY|EQUINOX|ENERGY\\s+FITNESS|ANYTIME\\s+FIT|EMGMFIT|CROSSFIT|YOGA|PILATES",
  "suscripciones"
 ],
 [
  "\\bREST\\b|RESTAURAN|BISTRO|BRASSERIE|CANTINA|MARISQUERIA|CEVICHERIA|TAQUER|TAQUIZA|BIRRIERIA|POZOLERIA",
  "comida"
 ],
 [
  "\\bBAR\\b|\\bANTRO\\b|LOUNGE|NIGHTCLUB|FAUNO|AZIA\\b|POOLHOUSE|CANDYLES|MOJITOS|LUANNA|PUERTA\\s*VERONA|RAKATA|TEMPO\\s+CLUB",
  "comida"
 ],
 [
  "STARBUCKS|CAFE\\b|CAFETERIA|COFFEE|CIELITO\\s+QUERIDO|PUNTA\\s+DEL\\s+CIELO|TIM\\s+HORTONS",
  "comida"
 ],
 [
  "VIPS\\b|TOKS\\b|SANBORNS|APPLEBEE|CHILIS\\b|FRIDAYS\\b|CALIFORNIA\\s+PIZZA|OUTBACK|ITALIANNIS|WINGS|ALITAS",
  "comida"
 ],
 [
  "MCDONALD|MC\\s*DONALDS|BURGER\\s*KING|BURGUER|WENDY|SUBWAY\\b|CARL.?S\\s+JR|JACK\\s+IN|SUPERBUR|BURGER",
  "comida"
 ],
 [
  "DOMINOS|PIZZA|LITTLE\\s*CAESARS|PAPA\\s*JOHNS|COPIZZA|CINCO\\s+REBANADAS|KFC\\b|POLLO\\s*LOCO|CHURCH.?S",
  "comida"
 ],
 [
  "SUSHI|ITTO|\\bDQ\\b|DAIRY\\s+QUEEN|NIEVE|HELADO|PALETERIA|PALETAS|FASTFOOD|FAST\\s+FOOD|ASTURIANO|BENDITAS|QUACK",
  "comida"
 ],
 [
  "UBER\\s*EATS|RAPPI|DIDI\\s*FOOD|DOORDASH|SIN\\s+DELANTAL|APP\\s+FOODS",
  "comida"
 ],
 [
  "MEZONTLE|BUNKA|CABARET|CERVEC|TRAGUITO|CULPABLE|MACA\\s+DE\\s+NOCHE|CASA\\s+CANTO|BARBACOA|TACOS|MARISQUE|COMAL\\b|CHOCOLATERIA",
  "comida"
 ],
 [
  "PALETER|NAHUALA|LOBOROJO|LOSROJOS|BURRERKI|SENSHI|COREANA|CASA\\s+SOLEDAD|EL\\s+OSO|ANTOJO|MONKEY\\s+PAPAS|BOKOBA|ZIRACCO",
  "comida"
 ],
 [
  "OXXO(?!\\s*GAS)|SEVEN\\s*ELEVEN|7[-\\s]?ELEVEN|CIRCLE\\s*K|EXTRA\\b|KIOSKO|SUPER\\s*Q\\b|SUPER\\s*CITY",
  "super"
 ],
 [
  "WAL\\s*MART|BODEGA\\s*AURRERA|SUPERAMA|SAM.?S|COSTCO|CHEDRAUI|SORIANA|LA\\s+COMER|CITY\\s+MARKET|HEB\\b|FRESKO",
  "super"
 ],
 [
  "CASA\\s+LEY|MERZA\\b|ALSUPER|SMART\\b|\\bSUP\\b|SUPERMERCADO|ABARR|MISC\\b|MISCELANEA|MINISUPER|MI\\s+SUPER|TIENDA\\s+DE\\s+LA\\s+ESQ",
  "super"
 ],
 [
  "MERCADO\\b(?!\\s*LIBRE|\\s*PAGO)|TIANGUIS|PANADERI|PASTELERIA|DULCERIA|FRUTAS|CARNICERIA|CARNES\\b|POLLERIA|TORTILLER|CREM\\b|CREMERIA|ABASO|ABASTO",
  "super"
 ],
 [
  "\\bUBER\\b|\\bDIDI\\b|CABIFY|INDRIVER|\\bTAXI\\b|BEAT\\b",
  "transporte"
 ],
 [
  "GASOL|\\bGAS\\s+(?!NATURAL|LP\\b)\\w+|SERVICIO\\s+(?:FGS|PONIENTE)|ESTACION\\s+DE\\s+SERVICIO|WAX\\b|AUTOLAVADO|CAR\\s*WASH",
  "transporte"
 ],
 [
  "PEMEX|GASOLIN|PETRO\\s*7|SHELL\\b|\\bBP\\b|HIDROSINA|OXXO\\s+GAS|G500|MOBIL\\b|ARCO\\b|REPSOL|TOTAL\\s+ENERGIES",
  "transporte"
 ],
 [
  "AUTOPISTA|CASETA|VIAPASS|TELEVIA|PASE\\b|IAVE\\b|CAPUFE|PLAZA\\s+DE\\s+COBRO",
  "transporte"
 ],
 [
  "MUEVE\\s+CIUDAD|FLECHA\\s+AMARILLA|METRO\\b|METROBUS|SUBURBANO|QROBUS|ADO\\b|ETN\\b|ESTRELLA\\s+BLANCA|PRIMERA\\s+PLUS|OMNIBUS|FUTURA\\b",
  "transporte"
 ],
 [
  "PARQUIMETRO|ESTACIONAMIENTO|PARKING|PARCO|VALET|AUTOPARQUE|PARK\\b",
  "transporte"
 ],
 [
  "APP\\s+TICKETS|EVENTOS\\b|HOLIDANCE|G2A|CINEPOLIS|CINEMEX|\\bCINE\\b|TICKETMASTER|SUPERBOLETOS|BOLETIA|EVENTBRITE|ETICKET|FUNTICKET|TEATRO|CONCIERTO",
  "entretenimiento"
 ],
 [
  "STEAM|PLAYSTATION|XBOX|NINTENDO|EPIC\\s+GAMES|RIOT|BLIZZARD|BOLICHE|BOWLING|KINGPIN|ESCAPE|SIX\\s+FLAGS|MUSEO|ZOO",
  "entretenimiento"
 ],
 [
  "FAR\\s+GUAD|PROSONRISAS|FARM|SIMILARES|DEL\\s+AHORRO|F\\s+AHORRO|BENAVIDES|SAN\\s+PABLO|GENERICOS|HOSPITAL|CLINICA|SANATORIO|MEDIC",
  "salud"
 ],
 [
  "LABORATORIO|CHOPO|SALUD\\s+DIGNA|OPTICA|DEVLYN|DENTAL|DENTISTA|ODONTOLOG|PSICOLOG|NUTRIOLOG|FISIOTERAPIA|\\bDR\\.?\\s",
  "salud"
 ],
 [
  "CFE\\b|TELMEX|INFINITUM|MEGACABLE|TOTALPLAY|IZZI\\b|AXTEL|TELCEL|AT&?T|MOVISTAR|BAIT\\b|UNEFON|SKY\\b",
  "servicios"
 ],
 [
  "GAS\\s+NATURAL|NATURGAS|ZETA\\s+GAS|GAS\\s+LP|AGUA\\b|CEA\\b|SEGURO|ALLIANZ|AXA\\b|METLIFE|GNP|MAPFRE|QUALITAS|HDI\\b",
  "servicios"
 ],
 [
  "PODER\\s+EJECUTIVO|GOBIERNO|TESORERIA|INMOBILIARIA|ARRENDA|CONDOMINIO|MANTENIMIENTO|UNIVERSIDAD|COLEGIO|INSTITUTO|TECNOLOGICO|ESCUELA|COLEGIATURA",
  "servicios"
 ],
 [
  "LAUNDRY|LAVANDERIA|TINTORERIA|PELUQUERIA|BARBER|ESTETICA|SPA\\b",
  "servicios"
 ],
 [
  "AMAZON|MERCADO\\s*LIBRE|MERCADOLIBRE|LIVERPOOL|PALACIO\\s+DE\\s+HIERRO|SEARS|SUBURBIA|COPPEL|ELEKTRA|SHEIN|TEMU|ALIEXPRESS",
  "compras"
 ],
 [
  "ZARA\\b|H&?M\\b|BERSHKA|PULL&?BEAR|STRADIVARIUS|MANGO\\b|NIKE|ADIDAS|PUMA\\b|INNOVASPORT|MARTI\\b|FLEXI|ANDREA\\b|CUIDADO\\s+CON\\s+EL\\s+PERRO",
  "compras"
 ],
 [
  "HOME\\s+DEPOT|IKEA|SODIMAC|FERRET|MACSTORE|IFIX|APPLE\\s+STORE|ISTORE|MIXUP|BEST\\s+BUY|STEREN|OFFICE\\s+DEPOT|OFFICEMAX|GANDHI|SANBORN",
  "compras"
 ],
 [
  "OVG\\s+EDC|MASCOTA|MINISO|TIKTOK|PAYPAL|FLORERIA|PERFUME|AUTOZONE|REFACC|GLOBOS|BALAUSTRADA|CASHI",
  "compras"
 ]
];
