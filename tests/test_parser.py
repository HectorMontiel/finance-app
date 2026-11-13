from ingesta.cifrado import cifrar, descifrar, clave_desde_texto, nueva_clave
from ingesta.categorias import categorizar
from ingesta.parser import parsear, quitar_duplicados

A = ("Estimado Cliente: Te informamos que se ha realizado una compra en el comercio NMX*NOVIBET con tu "
     "tarjeta de TDC terminación **8518, por un monto de $1,050.00 MXN. El 13/11/2026 a las 13:02:02 hrs. "
     "Atentamente Santander México")
C = ("¡Felicidades! esta compra podría darte hasta $21.06 MXN de cashback en tu cuenta Santander. Te informamos "
     "que se autorizó una compra con tu tarjeta de crédito terminación: 8518 . Monto: $421.30 MXN Comercio: "
     "SUSHI ITTO CENTRO SUR Fecha y hora: 04/11/2026 21:11:33 hrs Cada mes recibirás")
B = ("Autorizamos tu compra por $3,000.00 con tu Tarjeta de Crédito terminación **8518 y has llegado al límite "
     "de tu crédito. Establecimiento: REST BAR FAUNO. Fecha: 09/05/2026.")
T = ("Estimado cliente , realizaste una transferencia de tu cuenta terminación 4597 a la cuenta terminación 0281 "
     "en Mercado Pago W . Detalles de la operación Importe: $3,000.01 MXP Fecha: 13/11/2026 Hora: 10:06 hrs "
     "Referencia: 4801485 ¿No reconoces esta operación?")
E = ("estimado cliente , recibiste vía SPEI un abono por $500.00 MXN a tu cuenta terminación 4597 . Detalle de la "
     "operación Fecha: 12/11/2026 Hora: 07:30 hrs Banco emisor: BANAMEX Cuenta origen: 8111 Clave de rastreo: "
     "0859017 Concepto de pago: deposito El depósito ya se encuentra disponible")
R = ("NOTIFICACION DE RETIRO SIN TARJETA EN ATM. Apreciable cliente: Le informamos que el 12/11/2026 a las 17:40 "
     "hrs. se realizó un retiro de efectivo sin tarjeta por la cantidad de $300.00 pesos de su cuenta terminación 750 .")


def test_compra_a():
    m = parsear(A, "a1", "Pago/Compra con Tarjeta Santander")
    assert (m.f, m.h, m.m, m.tj, m.c, m.tipo, m.fmt) == ("2026-11-13", "13:02", 1050.0, "8518", "NMX*NOVIBET", "compra", "A")
    assert m.cat == "apuestas"


def test_compra_c_y_b():
    c = parsear(C, "c1", "Tu compra ha sido registrada.")
    assert (c.f, c.h, c.m, c.tj, c.c, c.fmt) == ("2026-11-04", "21:11", 421.30, "8518", "SUSHI ITTO CENTRO SUR", "C")
    assert c.cat == "comida"
    b = parsear(B, "b1", "Autorización por encima del límite")
    assert (b.f, b.m, b.c, b.fmt) == ("2026-05-09", 3000.0, "REST BAR FAUNO", "B")


def test_transferencia_deposito_retiro():
    t = parsear(T, "t1", "Confirmación de transferencia")
    assert (t.tipo, t.m, t.f, t.h, t.c, t.tj) == ("transferencia", 3000.01, "2026-11-13", "10:06", "MERCADO PAGO W ·0281", "4597")
    e = parsear(E, "e1", "Has recibido un depósito a tu cuenta")
    assert (e.tipo, e.m, e.c, e.tj, e.cat) == ("deposito", 500.0, "BANAMEX ·8111", "4597", "ingreso")
    r = parsear(R, "r1", "NOTIFICACION DE RETIRO SIN TARJETA EN ATM.")
    assert (r.tipo, r.m, r.h, r.tj, r.cat) == ("retiro", 300.0, "17:40", "750", "efectivo")


def test_pago_de_tarjeta_no_cuenta():
    assert parsear("Le informamos que recibimos su solicitud para pagar su tarjeta", "p", "Pago de tarjeta de crédito propias.") is None


def test_duplicados():
    a = {"id": "1", "f": "2026-11-04", "h": "21:11", "m": 421.3, "tj": "8518", "tipo": "compra", "c": "SUSHI", "fmt": "A"}
    c = {"id": "2", "f": "2026-11-04", "h": "21:12", "m": 421.3, "tj": "8518", "tipo": "compra", "c": "SUSHI", "fmt": "C"}
    b = {"id": "3", "f": "2026-11-04", "m": 421.3, "tj": "8518", "tipo": "compra", "c": "SUSHI", "fmt": "B"}
    # dos apuestas iguales con correo A a 3 minutos: son dos compras
    x1 = {"id": "4", "f": "2026-11-13", "h": "12:59", "m": 50.0, "tj": "8518", "tipo": "compra", "c": "NOVIBET", "fmt": "A"}
    x2 = {"id": "5", "f": "2026-11-13", "h": "13:02", "m": 50.0, "tj": "8518", "tipo": "compra", "c": "NOVIBET", "fmt": "A"}
    r = quitar_duplicados([c, a, b, x1, x2])
    assert sorted(x["id"] for x in r) == ["1", "4", "5"]
    assert next(x for x in r if x["id"] == "1")["dup"] == ["2", "3"]
    # un C sin su A se queda
    assert [x["id"] for x in quitar_duplicados([dict(c)])] == ["2"]


def test_categorias():
    assert categorizar("FARM GUADALAJARA 842") == "salud"
    assert categorizar("CONEKTA*PARCO") == "transporte"
    assert categorizar("OXXO CENTRO") == "super"
    assert categorizar("NETFLIX.COM") == "suscripciones"
    assert categorizar("AIRBNB * HMTMJ") == "viajes"
    assert categorizar("ALGO RARO") == "otros"


def test_cifrado_ida_y_vuelta():
    k = nueva_clave()
    clave = clave_desde_texto(k)
    obj = {"movs": [{"c": "ÑANDÚ", "m": 1.5}]}
    assert descifrar(cifrar(obj, clave), clave) == obj
