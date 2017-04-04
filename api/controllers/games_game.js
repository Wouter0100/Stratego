'use strict';

var mongoose = require('mongoose');
var User = mongoose.model('User');
var Game = mongoose.model('Game');

var wrap_promise = require('../../helpers/wrap_promise');
var HttpError = require('../../helpers/HttpError');

module.exports = {
    get: wrap_promise(getGame),
    delete: wrap_promise(deleteGame),
    post_start_board: wrap_promise(postStartBoard),
    get_actions: wrap_promise(getActions),
    post_actions: wrap_promise(postActions),
};

/**
 * Get information for a single game
 */
async function getGame(req, res) {
    const game = await Game.findByIdAndUser(req.params.id, req.user);

    res.json(game.outputForUser(req.user));
}

/**
 * Delete a single game
 */
async function deleteGame(req, res) {
    const game = await Game.findByIdAndUser(req.params.id, req.user);

    await game.remove();
    res.status(204).send('');
}

/**
 * Post a start board
 */
async function postStartBoard(req, res) {
    let game = await Game.findByIdAndUser(req.params.id, req.user);

    // Set up the start board
    game.setUpStartBoard(req.user._id, req.body);

    // Start the game!
    if(game.player1_set_up_pieces && game.player2_set_up_pieces) {
        game.player1_turn = true;
        game.start_board = game.board;
        game.setState(Game.STATE.STARTED);
    }

    game = await game.save();

    res.json(game.outputForUser(game));
}

// Get actions
async function getActions(req, res) {
    let game = await Game.findByIdAndUser(req.params.id, req.user);

    const actions = game.outputActionsForUser(req.user._id, game.actions);

    res.json(actions);
}

/**
 * Post a start board
 */
async function postActions(req, res) {
    let game = await Game.findByIdAndUser(req.params.id, req.user);

    let from_x = req.body.square.column;
    let from_y = req.body.square.row;
    let to_x = req.body.square_to.column;
    let to_y = req.body.square_to.row;

    // Rotate coordinates for player 2
    if(game.getPlayerNumber(req.user._id) === 2) {
        from_x = 9 - from_x;
        from_y = 9 - from_y;
        to_x = 9 - to_x;
        to_y = 9 - to_y;
    }

    let actions = game.doMove(
        req.user._id,
        from_x,
        from_y,
        to_x,
        to_y);

    if(game.isVsAI()) {
        const ai_move = game.getAIMove();
        const otherActions = game.doMove('ai',
            ai_move.square.column,
            ai_move.square.row,
            ai_move.square_to.column,
            ai_move.square_to.row);

        actions = actions.concat(otherActions);
    }

    await game.save();

    res.json({
        game: game.outputForUser(req.user),
        actions: game.outputActionsForUser(req.user._id, actions)
    });
}