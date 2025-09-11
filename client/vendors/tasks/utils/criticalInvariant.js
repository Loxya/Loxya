import colors from 'picocolors';

const criticalInvariant = (condition, msg) => {
    if (condition) {
        return;
    }

    // eslint-disable-next-line prefer-template
    console.error(colors.red(msg) + '\n\n');
    process.exit(1);
};

export default criticalInvariant;
