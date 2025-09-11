<?php
declare(strict_types=1);

namespace Loxya\Services;

use GuzzleHttp\Client;
use Loxya\Config\Config;
use Loxya\Contracts\Mailable;
use Loxya\Support\Arr;
use Loxya\Support\Assert;
use Mailjet\Client as MailjetClient;
use Mailjet\Resources;
use PHPMailer\PHPMailer\Exception as PHPMailerException;
use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use Soundasleep\Html2Text;

final class Mailer
{
    private array $sent = [];

    private ?string $fromEmail;

    private ?string $fromName;

    private array $config;

    public function __construct()
    {
        $this->config = Config::get('email');

        $from = $this->config['from'];
        $this->fromEmail = is_array($from) && isset($from['email']) ? $from['email'] : $from;
        $this->fromName = is_array($from) && isset($from['name']) ? $from['name'] : null;
    }

    /**
     * Déclenche l'envoi du mail.
     *
     * @param string|array $recipients Le ou les destinataires du mail.
     * @param string $subject Le sujet du mail à envoyer.
     * @param string $message Le contenu du mail à envoyer.
     * @param array|null $attachments Les éventuelles données à envoyer en pièce jointe.
     *                                Si non `null`, doit être un tableau ou un tableau de tableau contenant les clés:
     *                                - `content`: Le contenu du fichier de la pièce jointe).
     *                                - `filename`: Le nom du fichier de la pièce jointe).
     *                                - `mimeType`: Le type MIME du fichier de la pièce jointe).
     */
    public function send(string|array $recipients, string $subject, string $message, ?array $attachments = null): void
    {
        $recipients = (array) $recipients;
        $subject = trim($subject);
        $message = trim($message);

        if ($attachments !== null) {
            $attachments = !Arr::isList($attachments)
                ? [$attachments]
                : $attachments;
        }

        Assert::notEmpty($subject, "The mail subject cannot be empty.");
        Assert::notEmpty($message, "The mail content (message) cannot be empty.");

        $this->sent[] = compact('recipients', 'subject', 'message', 'attachments');
        if (Config::getEnv() === 'test') {
            return;
        }

        $transportMap = [
            'smtp' => '_sendWithSMTP',
            'loxya' => '_sendWithLoxya',
            'mailjet' => '_sendWithMailjet',
            'mail' => '_sendWithPhpMail',
        ];
        $driver = $this->config['driver'];
        if (!$driver || !array_key_exists($driver, $transportMap)) {
            $driver = 'mail';
        }
        $this->{$transportMap[$driver]}($recipients, $subject, $message, $attachments);
    }

    public function sendMailable(string|array $recipients, Mailable $mailable)
    {
        $subject = $mailable->getSubject();
        $content = $mailable->getContent();
        $attachments = $mailable->getAttachments();

        $this->send($recipients, $subject, $content, $attachments);
    }

    /**
     * @return list<array{ recipients: string[], subject: string, message: string, attachments: array }>
     */
    public function getSent(?int $count = null): array
    {
        return $this->sent;
    }

    /**
     * @return array{ recipients: string[], subject: string, message: string, attachments: array }|null
     */
    public function getLastSent(): array|null
    {
        $lastSentEmailKey = array_key_last($this->sent);
        if ($lastSentEmailKey === null) {
            return null;
        }
        return $this->sent[$lastSentEmailKey];
    }

    // ------------------------------------------------------
    // -
    // -    Transports Methods
    // -
    // ------------------------------------------------------

    private function _sendWithLoxya(
        array $recipients,
        string $subject,
        string $message,
        ?array $attachments = null,
    ): void {
        if (!$this->fromEmail) {
            throw new \Exception("Cannot send message with Loxya: missing 'from:' e-mail address.");
        }

        $data = [
            'instanceId' => Config::get('instanceId'),
            'replyTo' => $this->fromEmail,
            'recipients' => $recipients,
            'subject' => $subject,
            'content' => $message,
        ];

        if (!empty($attachments)) {
            $data['attachments'] = array_map(
                static fn ($attachment) => [
                    'filename' => $attachment['filename'],
                    'type' => $attachment['mimeType'],
                    'base64Content' => base64_encode($attachment['content']),
                ],
                $attachments,
            );
        }

        $client = new Client(['base_uri' => 'https://client.loxya.com/api/']);
        $response = $client->post('mail', [
            'json' => $data,
            'headers' => [
                'Content-Type' => 'application/json',
            ],
        ]);

        if ($response->getStatusCode() !== 200) {
            throw new \Exception(sprintf(
                "Delivery of the message with Loxya failed. API response (HTTP code %d) :\n%s",
                $response->getStatusCode(),
                json_encode($response->getBody(), JSON_PRETTY_PRINT),
            ));
        }
    }

    private function _sendWithMailjet(
        array $recipients,
        string $subject,
        string $message,
        ?array $attachments = null,
    ): void {
        $mailjetConfig = $this->config['mailjet'];

        $mail = new MailjetClient(
            $mailjetConfig['apiKey'],
            $mailjetConfig['apiSecretKey'],
            true,
            ['version' => 'v3.1'],
        );

        $body = [
            'SandboxMode' => Config::getEnv() !== 'production',
            'Messages' => [
                [
                    'From' => [
                        'Email' => $this->fromEmail,
                        'Name' => $this->fromName,
                    ],
                    'To' => array_map(
                        static fn ($recipient) => ['Email' => $recipient],
                        $recipients,
                    ),
                    'Subject' => $subject,
                    'HTMLPart' => $message,
                    'TextPart' => Html2Text::convert($message),
                ],
            ],
        ];

        if (!empty($attachments)) {
            $body['Messages'][0]['Attachments'] = array_map(
                static fn ($attachment) => [
                    'Filename' => $attachment['filename'],
                    'ContentType' => $attachment['mimeType'],
                    'Base64Content' => base64_encode($attachment['content']),
                ],
                $attachments,
            );
        }

        $response = $mail->post(Resources::$Email, compact('body'));
        if (!$response->success()) {
            throw new \RuntimeException(sprintf(
                "Delivery of the message with Mailjet failed. Mailjet response:\n%s",
                json_encode($response->getBody(), JSON_PRETTY_PRINT),
            ));
        }

        if (Config::getEnv() !== 'production') {
            debug($response->getBody());
        }
    }

    private function _sendWithSMTP(
        array $recipients,
        string $subject,
        string $message,
        ?array $attachments = null,
    ): void {
        $mail = new PHPMailer(true);
        $smtpConfig = $this->config['smtp'];
        $withAuth = $smtpConfig['username'] !== null;

        try {
            $mail->isSMTP();
            $mail->SMTPDebug = $withAuth ? SMTP::DEBUG_CLIENT : SMTP::DEBUG_OFF;
            $mail->Debugoutput = static function (string $message) {
                debug($message);
            };
            $mail->Host = $smtpConfig['host'];
            $mail->Port = $smtpConfig['port'];
            $mail->SMTPAuth = $withAuth;
            $mail->SMTPAutoTLS = $withAuth;
            $mail->Username = $withAuth ? $smtpConfig['username'] : null;
            $mail->Password = $withAuth ? $smtpConfig['password'] : null;
            $mail->SMTPSecure = $withAuth ? $smtpConfig['security'] : '';
            $mail->SMTPOptions = [
                'ssl' => [
                    'verify_peer' => false,
                    'allow_self_signed' => true,
                ],
            ];

            if (!$mail->smtpConnect()) {
                throw new \RuntimeException(
                    "Unable to connect to SMTP server. Please check configuration.",
                );
            }

            $mail->setFrom($this->fromEmail, $this->fromName ?? '');
            foreach ($recipients as $recipient) {
                $mail->addAddress($recipient);
            }

            $mail->isHTML(true);
            $mail->CharSet = 'UTF-8';
            $mail->Subject = $subject;
            $mail->Body = $message;
            $mail->AltBody = Html2Text::convert($message);

            if (!empty($attachments)) {
                foreach ($attachments as $attachment) {
                    $mail->addStringAttachment(
                        $attachment['content'],
                        $attachment['filename'],
                        PHPMailer::ENCODING_BASE64,
                        $attachment['mimeType'],
                    );
                }
            }

            $mail->send();
        } catch (PHPMailerException $e) {
            throw new \RuntimeException(sprintf(
                "Delivery of the message with SMTP failed. Reason:\n%s",
                $mail->ErrorInfo ?: $e->getMessage(),
            ));
        }
    }

    private function _sendWithPhpMail(
        array $recipients,
        string $subject,
        string $message,
        ?array $attachments = null,
    ): void {
        try {
            $mail = new PHPMailer(true);

            $mail->setFrom($this->fromEmail, $this->fromName ?? '');
            foreach ($recipients as $recipient) {
                $mail->addAddress($recipient);
            }

            $mail->isHTML(true);
            $mail->CharSet = 'UTF-8';
            $mail->Subject = $subject;
            $mail->Body = $message;
            $mail->AltBody = Html2Text::convert($message);

            if (!empty($attachments)) {
                foreach ($attachments as $attachment) {
                    $mail->addStringAttachment(
                        $attachment['content'],
                        $attachment['filename'],
                        PHPMailer::ENCODING_BASE64,
                        $attachment['mimeType'],
                    );
                }
            }

            $mail->send();
        } catch (PHPMailerException $e) {
            throw new \RuntimeException(sprintf(
                "Delivery of the message with PHP `mail()` failed. Reason:\n%s",
                $mail->ErrorInfo ?: $e->getMessage(),
            ));
        }
    }
}
