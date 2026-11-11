
export const Receipt = () => {
    return (
        <div style={{
            maxWidth: '400px',
            margin: 'auto',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            textAlign: 'center',
            padding: '1rem',
            border: '1px solid black'
        }}>
            <div>
                <strong>TECHSOLUCIONES CULKING</strong><br />
                <strong>Nit: 7336543014</strong><br />
                Direccion: Calle Cbba entre Plata y<br />
                presidente Montes, Galeria José<br />
                Gabriel. ORURO
            </div>

            <hr />

            <div>
                Fecha: Oct 4 2023 12:24PM<br />
                Cajero: mcmeyepinaya<br />
                Cliente: David Vargas Ala 5752455
            </div>

            <hr />

            <div>
                Impreso por: mcmeyepinaya<br />
                Vendedor: Meyer Pinaya Huarachi
            </div>

            <hr />

            <div style={{ textAlign: 'left' }}>
                <pre>
                    DESCRIPCION                  CANT  VALOR
                    Batería HP h504              1     340
                    Cargador Laptop punta azul   1     170

                    TOTAL CANTIDAD:              2
                    SUBTOTAL:                    510
                    Descuentos:                  0
                    TOTAL:                       510
                    FORMA DE PAGO:               Efectivo
                    VALOR:                       510
                </pre>
            </div>

            <hr />

            <div style={{ fontSize: '0.9rem' }}>
                <strong>GARANTIA DE EQUIPO UN AÑO</strong><br />
                No cubre golpes ni humedad, sitios donde<br />
                puede hacer efectiva su garantia<br />
                <strong>GARANTIA DE ACCESORIO TRES MESES:</strong> No<br />
                cubre golpes ni humedad, ni maltrato.
            </div>

            <hr />

            <div>www.culking.com</div>
        </div>
    )
}
