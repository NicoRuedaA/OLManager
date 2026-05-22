# Sistema de Fichajes — Documentación de Cambios

## Jugadores Incluídos en Negociación

### Descripción

Al **hacer una oferta** por un jugador ajeno O al **contraofertar** una oferta entrante por tu jugador, el usuario puede incluir hasta 2 jugadores de su squad principal o academia como parte del trato. Estos jugadores se valoran con su valor de mercado ajustado por edad y potencial, y se suman al total de la oferta.

### Agentes Libres

Cuando un jugador no tiene equipo (`team_id == null`), se ficha como **agente libre sin coste**. La fee se ignora y se cobra 0 al club. Los jugadores incluidos (si los hay) también se transfieren gratis.

### Valoración de Jugadores Incluídos

El valor de un jugador incluido no es su `market_value` puro. Se aplica un multiplicador por edad y otro por potencial:

**Multiplicador por edad:**

| Rango de Edad | Multiplicador |
|---------------|---------------|
| 16-20 | ×1.30 |
| 21-23 | ×1.20 |
| 24-26 | ×1.00 |
| 27-29 | ×0.90 |
| 30-32 | ×0.75 |
| 33+ | ×0.60 |

**Multiplicador por potencial (gap = `potential_base - ovr`):**

| Gap | Multiplicador |
|-----|---------------|
| ≥ 15 | ×1.20 |
| ≥ 10 | ×1.10 |
| ≥ 5 | ×1.05 |
| < 5 | ×1.00 |

**Fórmula:** `valor_final = market_value × age_multiplier × potential_multiplier`

### Flujo al Hacer Oferta

1. El usuario selecciona un jugador ajeno y pulsa "Hacer oferta" (desde TransfersTab o desde el perfil del jugador)
2. Se abre el modal de oferta
3. Selecciona destino (principal/academia)
4. Ajusta el monto en efectivo
5. Selecciona hasta 2 jugadores de su squad/academia para incluir en el trato (opcional)
6. Ve el impacto proyectado en presupuesto y salarios
7. Envía la oferta

El sistema compara el valor total (cash + jugadores incluidos) contra el umbral mínimo aceptable del vendedor:

- **Si `fee_cash >= umbral_ajustado - valor_jugadores`** → Aceptada (si el jugador también acepta)
- **Si está dentro del rango de contraoferta** → Contraoferta
- **Si está por debajo** → Rechazada

### Flujo al Contraofertar

1. El usuario recibe una oferta entrante por un jugador
2. Abre el modal de contraoferta
3. Ajusta el monto en efectivo (como antes)
4. Selecciona hasta 2 jugadores de su squad/academia para incluir en el trato (opcional)
5. Envía la contraoferta

El sistema compara el valor total (cash + jugadores incluidos) contra el techo de negociación del comprador:

- **Si `fee_cash + valor_jugadores <= techo_ajustado`** → Aceptada
- **Si está dentro de la ventana de contraoferta** → Contraoferta
- **Si excede la ventana** → Rechazada

### Reglas

- Máximo **2 jugadores** incluidos por oferta
- Solo **transferencias permanentes** (no cesiones)
- No se pueden incluir jugadores que ya tengan ofertas pendientes
- No se pueden incluir jugadores con contrato expirado (0 días restantes)
- No se puede incluir al jugador que está siendo transferido/comprado
- Los jugadores incluidos se transfieren **gratis** (fee = 0)
- El club vendedor pierde referencias a los jugadores incluidos (starting XI, training groups, roles, etc.)

### Consecuencias

- Si la oferta es **aceptada**: el jugador principal + los incluidos se mueven al club correspondiente
- Si la oferta es **rechazada**: ningún jugador se mueve
- Si la IA contraoferta, no incluye jugadores del usuario (simplificación)

### UI — Modales Alineados

Todos los modales de negociación (hacer oferta, contraoferta, perfil del jugador) comparten la misma estructura:

1. Selector de destino (solo en "Hacer oferta")
2. Campo de monto en efectivo
3. Selector de jugadores incluidos (0-2)
4. Panel de impacto proyectado (presupuesto, balance, salarios)
5. Panel de feedback de negociación (mood, tensión, paciencia, ronda)
6. Historial de negociación (últimas ofertas)
7. Mensaje de resultado (aceptada/rechazada/contraofertada)
8. Botones de acción

- Cada fila del selector de jugadores muestra: rol, nombre, edad y valor de mercado
- Selección toggle: click para añadir/quitar
- Contador visual: `X/2 seleccionados`
- Jugadores no seleccionables (límite alcanzado) aparecen deshabilitados
- Si no hay jugadores elegibles, se muestra mensaje informativo
