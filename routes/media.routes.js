//*********************************************************
// Маршрутизация для модуля, в котором происходит загрузка
// файлов на сервер
//*********************************************************

const { Router } = require('express');
const { check, validationResult }
    = require('express-validator');         // Для валидации поступивших данных
const bcrypt = require('bcryptjs');         // Для шифрования пароля
const jwt = require('jsonwebtoken');        // Для работы с токенами
const router = Router();                    // Маршрутизация
const logger = require('../logger/logger'); // Логгер
const fetch = require('node-fetch');
const config = require("config");           // Подключение конфига
const { address_config }
    = require('../config/address.config');  // Константы маршрутов
const {                                     // Подключение моделей для взаимодействия с базой данных
    User, PersonalData, UserAttributes,
    UserModules, GroupAttributes, GroupModules,
    UserGroups, UserRoles, TaskMarks,
    DataPlayers, Commands, CoordPlayers,
    InfoGames, Quests, RegisterCommands,
    Marks, Warnings, Bans,
    QueueGamesCheck, CheckedGames, GamesQuests,
} = require('../sequelize/models');
const { checkTokenAccess }
    = require('../checks/token.access.js'); // Проверка токена
const { checkAccessModule }
    = require('../checks/module.access');   // Проверка доступа к модулю

function upload_file(req, res) {
    // Request body is binary
    req.setBodyEncoding("binary");

    // Handle request as multipart
    var stream = new multipart.Stream(req);

    // Create promise that will be used to emit event on file close
    var closePromise = new events.Promise();

    // Add handler for a request part received
    stream.addListener("part", function (part) {
        sys.debug("Received part, name = " + part.name + ", filename = " + part.filename);

        var openPromise = null;

        // Add handler for a request part body chunk received
        part.addListener("body", function (chunk) {
            // Calculate upload progress
            var progress = (stream.bytesReceived / stream.bytesTotal * 100).toFixed(2);
            var mb = (stream.bytesTotal / 1024 / 1024).toFixed(1);

            sys.debug("Uploading " + mb + "mb (" + progress + "%)");

            // Ask to open/create file (if not asked before)
            if (openPromise == null) {
                sys.debug("Opening file");
                openPromise = posix.open("./uploads/" + part.filename, process.O_CREAT | process.O_WRONLY, 0600);
            }

            // Add callback to execute after file is opened
            // If file is already open it is executed immediately
            openPromise.addCallback(function (fileDescriptor) {
                // Write chunk to file
                write_chunk(req, fileDescriptor, chunk,
                    (stream.bytesReceived == stream.bytesTotal), closePromise);
            });
        });
    });

    // Add handler for the request being completed
    stream.addListener("complete", function () {
        sys.debug("Request complete");

        // Wait until file is closed
        closePromise.addCallback(function () {
            // Render response
            res.sendHeader(200, { "Content-Type": "text/plain" });
            res.sendBody("Thanks for playing!");
            res.finish();

            sys.puts("\n=> Done");
        });
    });
}

router.post(                                
    address_config.m_upload_users_file,
    async (req, res) => {
        upload_file(req, res);
    });

router.post(
    address_config.m_download_users_file,
    async (req, res) => {

    });

module.exports = router;