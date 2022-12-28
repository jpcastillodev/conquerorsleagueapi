const functions = require("firebase-functions");

require('dotenv').config()
const express = require("express")
const morgan = require('morgan')
const cors = require("cors")
const { Client } = require('pg')



const api = express()
const client = new Client({
    user: 'postgres',
    host: '34.125.69.44',
    database: 'inhouse_bot',
    password: 'j8R0!&6nM90d1',
    port: 5432,
})
client.connect()

api.use(cors())
api.use(morgan('tiny'));


api.post("/ranking", async (req, res) => {
    try {
    
        const { rows: rating } = await client.query(`
        SELECT 
            player.name,
            player.id,
            player_rating.trueskill_mu, 
            player_rating.trueskill_sigma, 
            player_rating.role
            
        FROM player
        INNER JOIN player_rating
        ON player.id=player_rating.player_id`)


        const { rows: history } = await client.query(`
        SELECT 
          *
        FROM game
        INNER JOIN game_participant
        ON game.id=game_participant.game_id`)

        const ranking = rating.map(player => {
            const players_matchs = history.filter(match => match.player_id === player.id)
            const wins = players_matchs.filter(match => match.winner === match.side)
            const looses = players_matchs.length - wins.length

            return {
                ...player,
                looses: looses,
                wins: wins.length,
                nick: player.name.toUpperCase(),
                mmr: Number((20 * (player.trueskill_mu - 3 * player.trueskill_sigma + 25)).toFixed())

            }
        }).sort((a, b) => b.mmr - a.mmr)

        res.send({ payload: ranking });
    } catch (err) {
        console.log(err)
        res.sendStatus(400)
    }
    res.end()
})
api.post("/live-games", async (req, res) => {
    try {

        const { rows: games } = await client.query(`
        SELECT 
            game.id,
            game.blue_expected_winrate,
            game_participant.player_id,
            game_participant.side,
            game_participant.name,
            game_participant.role

        FROM game
        INNER JOIN game_participant
        ON game.id=game_participant.game_id
        WHERE winner is NULL`)

        const hash_map = games.reduce((hash, row) => ({...hash, [row.id]: [
            ...(hash[row.id] || []),
            row
        ]}), {})


        res.send({ payload: hash_map });
    } catch (err) {
        console.log(err)
        res.sendStatus(400)
    }
    res.end()
})
api.post("/match-history", async (req, res) => {
    try {

        const { rows: games } = await client.query(`
        SELECT 
            game.id,
            game.blue_expected_winrate,
            game_participant.player_id,
            game_participant.side,
            game_participant.name,
            game_participant.role,
            game.winner
        FROM game
        INNER JOIN game_participant
        ON game.id=game_participant.game_id
        WHERE winner is not NULL`)

        const hash_map = games.reduce((hash, row) => ({...hash, [row.id]: [
            ...(hash[row.id] || []),
            row
        ]}), {})


        res.send({ payload: hash_map });
    } catch (err) {
        console.log(err)
        res.sendStatus(400)
    }
    res.end()
})
api.post("/profile/:uid", async (req, res) => {
    try {
        const player_id = req.params.uid
        if (!player_id) {
            res.send({ payload: {} });
            return
        }
        const { rows: games } = await client.query(`
        SELECT 
            game.id,
            game.blue_expected_winrate,
            game_participant.player_id,
            game_participant.side,
            game_participant.name,
            game_participant.role,
            game.winner
        FROM game
        INNER JOIN game_participant
        ON game.id=game_participant.game_id
        WHERE winner is not NULL
        `)

        const { rows: [rating] } = await client.query(`
        SELECT 
            player.name,
            player.id,
            player_rating.trueskill_mu, 
            player_rating.trueskill_sigma, 
            player_rating.role
            
        FROM player
        INNER JOIN player_rating
        ON player.id=player_rating.player_id
        WHERE id=${player_id}
        `)


        const { rows: history } = await client.query(`
        SELECT 
          *
        FROM game_participant
        INNER JOIN game
        ON game.id=game_participant.game_id
        WHERE player_id=${player_id}
        `)


        const players_matchs = history
        const wins = players_matchs.filter(match => match.winner === match.side)
        const looses = players_matchs.length - wins.length

        const player_games = games.filter(game => game.player_id === player_id).map(game => game.id)
        const hash_map = games
            .filter(game => player_games.includes(game.id))
            .reduce((hash, row) => ({
                ...hash, [row.id]: [
                    ...(hash[row.id] || []),
                    row
                ]
            }), {})

            const profile = {
                ...rating,
                looses: looses,
                wins: wins.length,
                nick: rating.name.toUpperCase(),
                mmr: Number((20 * (rating.trueskill_mu - 3 * rating.trueskill_sigma + 25)).toFixed())

            }

        res.send({ profile, payload: hash_map });
    } catch (err) {
        console.log(err)
        res.sendStatus(400)
    }
    res.end()
})
exports.api = functions.https.onRequest(api)

