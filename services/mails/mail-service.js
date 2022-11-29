const config = require("config");
const nodemailer = require('nodemailer');

class MailService {

    constructor() {
        this.transporter = nodemailer.createTransport({
            host: config.get("smtp_host"),
            port: config.get("smtp_port"),
            secure: false,
            auth: {
                user: config.get("smtp_user"),
                pass: config.get("smtp_password")
            }
        });
    }

    async sendActivationMail(to, link) {
        await this.transporter.sendMail({
            from: config.get("smtp_user"),
            to,
            subject: 'Активация аккаунта на ' + config.get("client_url"),
            text: '',
            html:
                `
                <div>
                    <h1> Для активации аккаунта перейдите по ссылке </h1>
                    <a href="${link}">${link}</a>
                </div>
            `
        });
    }
}

module.exports = new MailService();