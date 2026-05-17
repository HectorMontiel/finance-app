"""
Categorizer — maps merchant name → TransactionCategory.
Order matters: first match wins.

Filosofía de categorías:
  FOOD        → gasto de sustento: súper, conveniencia, comida rápida, delivery
  TRANSPORT   → movilidad: Uber ride, gasolina, casetas, metro, aviones
  ENTERTAIN   → ocio/social: RESTAURANTES, bares, antros, cafés de salida,
                             cine, gym, streaming, videojuegos
  HEALTH      → salud: farmacias, médicos, dentistas
  UTILITIES   → servicios fijos: luz, teléfono, renta, seguros, escuela
  SHOPPING    → compras no esenciales: ropa, electrónica, Amazon, Mercado Libre
  TRANSFER    → SPEI, retiros, depósitos
  OTHER       → sin categoría reconocida
"""

import re
from app.models.transaction import TransactionCategory

_RULES: list[tuple[str, TransactionCategory]] = [

    # ── 1. Transfers (always first) ──────────────────────────────────────── #
    (r"SPEI|TRANSFERENCIA|TRASPASO|RETIRO\b|DEPOSITO\b|PAGO\s+INTERBANCARIO|CODI\b",
     TransactionCategory.TRANSFER),

    # ── 2. Restaurants, bars, antros → ENTERTAINMENT ─────────────────────── #
    # Sit-down restaurants & bars are DISCRETIONARY / social spending
    (r"\bREST(?:AURANTE?)?\s+BAR\b|\bBAR\s+\w|\bANTRO\b|\bLOUNGE\b|\bNIGHTCLUB\b",
     TransactionCategory.ENTERTAINMENT),
    (r"\bREST\b\s+\w{2}|\bRESTAURANT\b|\bRESTAURANTE\b|\bBISTRO\b|\bBRASSERIE\b",
     TransactionCategory.ENTERTAINMENT),
    (r"FAUNO|AZIA\b|POOLHOUSE|CANDYLES|MOJITOS|LUANNA|PUERTA\s*VERONA|MITSPUG",
     TransactionCategory.ENTERTAINMENT),
    (r"CANTINA\b|MARISQUERIA|CEVICHERIA|TAQUIZA\b|BIRRIERIA|POZOLERIA\b",
     TransactionCategory.ENTERTAINMENT),
    (r"STARBUCKS|CAFE\s+PUNTA|CIELITO\s+QUERIDO|ITALIAN\s+COFFEE|THE\s+COFFEE\s+TREE",
     TransactionCategory.ENTERTAINMENT),  # coffee shops = social outing
    (r"VIPS\b|TOKS\b|APPLEBEE|CHILIS\b|FRIDAYS\b|CALIFORNIA\b\s+PIZZA|OUTBACK",
     TransactionCategory.ENTERTAINMENT),

    # ── 3. Food / grocery / delivery / fast food → FOOD ─────────────────── #
    (r"OXXO|SEVEN\s*ELEVEN|7[-\s]ELEVEN|CIRCLE\s*K|SUPER\s*CITY|EXTRA\b",
     TransactionCategory.FOOD),
    (r"WALMART|BODEGA\s*AURRERA|SUPERAMA|SAM.?S\s*CLUB|COSTCO|CHEDRAUI|SORIANA",
     TransactionCategory.FOOD),
    (r"LA\s+COMER|CITY\s+MARKET|MEGA\s+COMERCIAL|HEB\b|FRESKO|WALMART\s+EXPRESS",
     TransactionCategory.FOOD),
    (r"CASA\s+LEY|MERZA\b|BODEGAS\s+ALIANZA|COMERCIAL\s+MEXICANA",
     TransactionCategory.FOOD),
    (r"UBER\s*EATS|RAPPI\b|DIDI\s*FOOD|DOORDASH|CORNERSHOP|INSTACART",
     TransactionCategory.FOOD),   # delivery = home food
    (r"MCDONALDS|MC\s*DONALDS|BURGER\s*KING|BURGUER\s*KING|WENDY.?S|SUBWAY\b",
     TransactionCategory.FOOD),
    (r"DOMINOS|PIZZA\s*HUT|LITTLE\s*CAESARS|PAPA\s*JOHNS|TELEPIZZA",
     TransactionCategory.FOOD),
    (r"KFC\b|POLLO\s*LOCO|EL\s+POLLO\s+LOCO|CHURCH.?S\s+CHICKEN",
     TransactionCategory.FOOD),
    (r"MERCADO\b|TIANGUIS|ABARROTES|MISCELANEA|MINISUPER|MINISUP|SUPER\s+SERV",
     TransactionCategory.FOOD),
    (r"PANADERIA|PASTELERIA|DULCERIA|HELADERIA|NIEVE\b|PALETAS",
     TransactionCategory.FOOD),
    (r"BPK\*MISC|CLIP\s*MX\*ABARR|SUNROLL|MERCADOPAGO\s*\*\w+FOOD",
     TransactionCategory.FOOD),

    # ── 4. Transport ─────────────────────────────────────────────────────── #
    (r"\bUBER\b(?!\s*EATS)", TransactionCategory.TRANSPORT),
    (r"\bDIDI\b(?!\s*FOOD)|\bDIDI\s*MOV", TransactionCategory.TRANSPORT),
    (r"CABIFY|INDRIVER|BEAT\s*RIDE|\bTAXI\b", TransactionCategory.TRANSPORT),
    (r"PEMEX|GASOLINA|PETRO\s*7|SHELL\b|BP\s+COMB|HIDROSINA|GASOL\b|GAS\s+FGS",
     TransactionCategory.TRANSPORT),
    (r"AUTOPISTA|CASETA|VIAPASS|TELEVIA|IAVE\b|CAPUFE|CUOTA\b|PLAZA\s+DE\s+COBRO",
     TransactionCategory.TRANSPORT),
    (r"METRO\b|STC\s+METRO|METROBUS|TROLEBUS|SUBURBANO|MEXIBUS",
     TransactionCategory.TRANSPORT),
    (r"ADO\b|ETN\b|ESTRELLA\s+BLANCA|PRIMERA\s+PLUS|OMNIBUS|AUTOVIAS|FUTURA\b",
     TransactionCategory.TRANSPORT),
    (r"AEROMEXICO|VOLARIS|VIVAAEROBUS|INTERJET|AMERICAN\s+AIRLINES|UNITED\s+AIR|DELTA\s+AIR",
     TransactionCategory.TRANSPORT),
    (r"PARQUIMETRO|ESTACIONAMIENTO|PARKING\b|VALET\b|AUTOPARQUE",
     TransactionCategory.TRANSPORT),

    # ── 5. Entertainment / leisure ───────────────────────────────────────── #
    (r"NETFLIX|PRIME\s+VIDEO|DISNEY\+?|HBO\s*MAX|\bMAX\b\s+STR|APPLE\s+TV|PARAMOUNT|CRUNCHYROLL|BLIM\b",
     TransactionCategory.ENTERTAINMENT),
    (r"SPOTIFY|DEEZER|APPLE\s+MUSIC|YOUTUBE\s+PREMIUM|AMAZON\s+MUSIC",
     TransactionCategory.ENTERTAINMENT),
    (r"CINEPOLIS|CINEMEX|\bCINE\b|MULTICINE",
     TransactionCategory.ENTERTAINMENT),
    (r"STEAM\b|PLAYSTATION|XBOX\b|NINTENDO|EA\s+PLAY|UBISOFT|EPIC\s+GAMES|BLIZZARD|RIOT\s+GAMES",
     TransactionCategory.ENTERTAINMENT),
    (r"TICKETMASTER|SUPERBOLETOS|BOLETIA|EVENTBRITE|CONCIERTO|TEATRO\b",
     TransactionCategory.ENTERTAINMENT),
    (r"GYM\b|GYMNASIUM|SMART\s*FIT|SPORT\s+CITY|EQUINOX|TOTAL\s+PLAY\s+FIT",
     TransactionCategory.ENTERTAINMENT),
    (r"YOGA\b|PILATES|CROSSFIT|SPINNING\b|ZUMBA\b|GIMNASIO",
     TransactionCategory.ENTERTAINMENT),
    (r"KINGPIN|BOWLING|LASER\s+TAG|ESCAPE\s+ROOM|TRAMPOLINES|SKYZONE",
     TransactionCategory.ENTERTAINMENT),
    (r"CLAUDE\.AI|OPENAI|CHATGPT|ANTHROPIC|COPILOT\b",
     TransactionCategory.ENTERTAINMENT),
    (r"PLANETARIO|MUSEO\b|ACUARIO|ZOOLOGICO|\bZOO\b|SIX\s+FLAGS",
     TransactionCategory.ENTERTAINMENT),

    # ── 6. Health ─────────────────────────────────────────────────────────── #
    (r"FARMACIA|SIMILARES|DEL\s+AHORRO|BENAVIDES|GUADALAJARA\s+FARM|GENERICOS\s+INT",
     TransactionCategory.HEALTH),
    (r"HOSPITAL|CLINICA|SANATORIO|CENTRO\s+MEDICO|IMSS\b|ISSSTE\b|CRUZ\s+ROJA|STAR\s+MEDICA",
     TransactionCategory.HEALTH),
    (r"\bDR\.?\s|\bDOCTOR\b|\bMEDICO\b|CONSULTORIO|PEDIATRA|GINECOLOGO|DERMATOLOGO",
     TransactionCategory.HEALTH),
    (r"LABORATORIO|LAB\s+CLINICO|RAYOS\s+X|ULTRASONIDO|RESONANCIA",
     TransactionCategory.HEALTH),
    (r"OPTICA\b|LENTES\b|DEVLYN\b|MULTIOPTICAS",
     TransactionCategory.HEALTH),
    (r"DENTAL\b|ODONTOLOG|DENTISTA|ORTODONCIA|PROSONRISAS",
     TransactionCategory.HEALTH),
    (r"PSICOLOG|PSIQUIATR|NUTRIOLOG|FISIOTERAPIA",
     TransactionCategory.HEALTH),

    # ── 7. Utilities / fixed services ────────────────────────────────────── #
    (r"INSTITUTO\s+TECNOL|UNIVERSIDAD|COLEGIO\b|TECNOLOGICO|TEC\s+DE\s+MONT|UNAM\b|UAM\b|ANAHUAC\b",
     TransactionCategory.UTILITIES),
    (r"CFE\b|COMISION\s+FED|LUZ\s+Y\s+FUERZA|ELECTRICIDAD",
     TransactionCategory.UTILITIES),
    (r"TELMEX|INFINITUM|MEGACABLE|TOTALPLAY|IZZI\b|AXTEL\b|SKY\s+DISH|TELECABLE",
     TransactionCategory.UTILITIES),
    (r"TELCEL\b|AT&?T\b|MOVISTAR|BAIT\s+MOVIL|UNEFON|CIERTO\b",
     TransactionCategory.UTILITIES),
    (r"GAS\s+NATURAL|NATURGAS|GASNOVA|ZETA\s+GAS|GAS\s+LP\b",
     TransactionCategory.UTILITIES),
    (r"SACMEX|SIAPA\b|CAEM\b|COMAPA|SISTEMA\s+DE\s+AGUA",
     TransactionCategory.UTILITIES),
    (r"SEGURO\b|ALLIANZ|AXA\b|METLIFE|GNP\s+SEGUROS|MAPFRE|QUALITAS|HDI\b",
     TransactionCategory.UTILITIES),
    (r"INMOBILIARIA|ARRENDADORA|CONDOMINIO\b|MANTENIMIENTO\s+EDI|CUOTA\s+COND",
     TransactionCategory.UTILITIES),
    (r"MU\s+INSTITUTO|OTEVA\b",
     TransactionCategory.UTILITIES),

    # ── 8. Shopping / non-essential purchases ────────────────────────────── #
    (r"AMAZON(?!\s*MUSIC|\s*PRIME)", TransactionCategory.SHOPPING),
    (r"LIVERPOOL|PALACIO\s+DE\s+HIERRO", TransactionCategory.SHOPPING),
    (r"SEARS\b|SUBURBIA|COPPEL|FAMSA|ELEKTRA\b", TransactionCategory.SHOPPING),
    (r"ZARA\b|H&?M\b|BERSHKA|PULL&?BEAR|STRADIVARIUS|MANGO\b|FOREVER\s+21|SHEIN",
     TransactionCategory.SHOPPING),
    (r"MERCADO\s*LIBRE|MERCADOLIBRE|LINIO\b|WISH\b|ALIEXPRESS|TEMU\b",
     TransactionCategory.SHOPPING),
    (r"HOME\s+DEPOT|IKEA\b|SODIMAC|TRUPER\b|ACE\s+HARDWARE|FERRETERIA",
     TransactionCategory.SHOPPING),
    (r"APPLE\s+STORE|ISTORE\b|MIXUP\b|BEST\s+BUY|MACSTORE|RADIOSHACK",
     TransactionCategory.SHOPPING),
    (r"NIKE\b|ADIDAS\b|PUMA\b|REEBOK\b|NEW\s+BALANCE|UNDER\s+ARMOUR|FOOT\s+LOCKER|FLEXI\b|ANDREA\b",
     TransactionCategory.SHOPPING),
    (r"AUTOZONE|REFACC\w*|AUTO\s+PARTES|VALVOLINE|JIFFY\s+LUBE",
     TransactionCategory.SHOPPING),
    (r"MINISO\b|TOUTEMS\b|PAYPAL\s*\*|FRAGRANCENET|OVG\s+EDC",
     TransactionCategory.SHOPPING),
    (r"CLIP\s*MX\*|SQ\s+T\d+\s+\w",
     TransactionCategory.SHOPPING),

    # ── 9. Mercado Pago — prefix stripping patterns ──────────────────────── #
    # MP sometimes prefixes descriptions with "MP*" or "MERCADOPAGO*".
    # These catch-all patterns apply AFTER the specific rules above,
    # so "MP*SPOTIFY" → already matched by rule 5; "MP*UNKNOWN_STORE" → SHOPPING.
    (r"^MP\*(?:SUPER|WALMART|BODEGA|OXXO|TIENDA|MARKET|ABARROTE)",
     TransactionCategory.FOOD),
    (r"^MP\*(?:UBER|DIDI|TAXI|GASOLINA|GAS\s|PEMEX)",
     TransactionCategory.TRANSPORT),
    (r"^MP\*(?:FARMACIA|HOSPITAL|CLINICA|SALUD|MEDICO)",
     TransactionCategory.HEALTH),
    (r"^MP\*(?:LUZ|CFE|TELMEX|TELCEL|AT&?T|MOVISTAR|GAS\s+NAT|RENTA|COLEGIO|ESCUELA)",
     TransactionCategory.UTILITIES),
    (r"^MP\*|^MERCADOPAGO\*",
     TransactionCategory.SHOPPING),    # generic MP purchase → SHOPPING fallback
]

_COMPILED = [
    (re.compile(p, re.IGNORECASE), cat) for p, cat in _RULES
]


def categorize(concepto: str) -> TransactionCategory:
    """Return best-matching category for *concepto*. Defaults to OTHER."""
    for pattern, category in _COMPILED:
        if pattern.search(concepto):
            return category
    return TransactionCategory.OTHER
