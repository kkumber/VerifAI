const {z} = require('zod');
const logger = require('../logger');

const gemmaResponseSchema = z.object({
    verdict: z.enum(['True', 'False', 'Partially True', 'Unverifiable']),
    errors: z.array(
        z.object({
            claim: z.string(),
            correction: z.string(),
            reason: z.string(),
            source: z.string(),
            url: z.string().url().or(z.literal('')),
        })
    ),
    overall_reason: z.string(),
    related_topics: z.array(z.string()),
});

async function convertToValidJson(response) {
    try {
        const json = JSON.parse(response);
        return gemmaResponseSchema.parse(json);
    } catch (err) {
        logger.error('AI response schema validation failed', {error: err});
        throw new SyntaxError('AI response is not valid or does not match schema.');
    }
}

module.exports = {convertToValidJson};
