const Partida = require('../models/Partida');
const Jugador = require('../models/Jugador');
const Record = require('../models/Record');

// Guarda la partida a MongoDB quan s'acaba un nivell
const guardarPartida = async (room, nivelCompletado, victoria) => {
    try {
        const jugadorsParticipants = Object.values(room.players).map(p => ({
            nickname: p.nickname,
            color: p.color
        }));

        const ara = new Date();
        const inici = room._partidaInici || ara;
        const duracioSegons = Math.round((ara - inici) / 1000);

        const partida = await Partida.create({
            data_inici: inici,
            data_fi: ara,
            duracio_segons: duracioSegons,
            nivell_completat: nivelCompletado,
            victoria: victoria,
            jugadors_participants: jugadorsParticipants
        });

        console.log(`[DB] Partida guardada (Nivell ${nivelCompletado}, ${duracioSegons}s, victòria: ${victoria})`);

        // Actualitzar estadístiques de cada jugador
        for (const p of jugadorsParticipants) {
            await Jugador.findOneAndUpdate(
                { nickname: p.nickname },
                {
                    $inc: { total_partides: 1 },
                    $max: { nivell_maxim_assolit: nivelCompletado },
                    $min: { millor_temps_segons: duracioSegons }
                },
                { upsert: true, new: true }
            );
        }

        // Guardar rècord de temps per cada jugador
        if (victoria) {
            for (const p of jugadorsParticipants) {
                await Record.create({
                    nickname: p.nickname,
                    nivell: nivelCompletado,
                    temps_segons: duracioSegons,
                    jugadors_totals: jugadorsParticipants.length
                });
            }
            console.log(`[DB] Rècords de temps guardats per Nivell ${nivelCompletado}`);
        }

        return partida;
    } catch (err) {
        console.warn('[DB] No s\'ha pogut guardar la partida (MongoDB potser no disponible):', err.message);
        return null;
    }
};

module.exports = { guardarPartida };
