// The privacy policy, terms and help page. Kept apart from the UI strings because they're read and changed
// as whole documents; another language is another set of these. Every statement here must stay true to
// what the code does: change this file in the same commit as the behaviour it describes.

export const OPERATOR = 'Ogun Gundogdu';
export const CONTACT_EMAIL = 'support@ogun.se';

export interface LegalDocument {
  title: string;
  updated: string;
  intro: string;
  sections: { heading: string; paragraphs: string[] }[];
}

export const privacy: LegalDocument = {
  title: 'Privacy policy',
  updated: '9 October 2026',
  intro: `Bookclub is a small, free service run by ${OPERATOR} (“we”). This page says what we keep about you, why, who else handles it, and how to get it or have it deleted. Questions go to ${CONTACT_EMAIL}.`,
  sections: [
    {
      heading: 'What we keep',
      paragraphs: [
        'Your account: your name, your email address and, if you set one, your password, stored only as a salted hash. If you sign in with Google, Google gives us your name, email address, profile picture link and Google account ID.',
        'Signed-in devices: for each session, the IP address and the browser or device it came from, so you can see your devices and sign them out. A session ends when you sign out, or after 30 days without use.',
        'Your reading: the books and editions you read, the page range of your copy, the progress you log and when, and when you finish or stop.',
        'Clubs: the clubs you are in, your role, and what club admins write: name, description, meeting times and places, reading targets.',
        'Notes: what you write, where in the book, who it is for, your replies and reactions, notes you report (with the reason you give) and the people you block.',
      ],
    },
    {
      heading: 'Who sees what',
      paragraphs: [
        "Members of your clubs see your name, your role and your progress on the club's book. Club notes are seen by club members. Public notes are seen, with your name, by anyone signed in who reads that book. Private notes are seen only by you. Your email address is never shown to other readers.",
        'Moderators, people we appoint to review reported notes, see a reported note, who wrote it and who reported it.',
      ],
    },
    {
      heading: 'Why we keep it',
      paragraphs: [
        'To give you the service you signed up for (our agreement with you): your account, reading, clubs and notes.',
        'Our legitimate interest in keeping Bookclub safe and working: rate limits, reports and blocks, error reports, backups and security.',
        "We don't sell your data, show ads, or use analytics or tracking cookies.",
      ],
    },
    {
      heading: 'Who else handles it',
      paragraphs: [
        'OVHcloud runs our servers and database, in the EU.',
        'Resend delivers our emails: confirmations, password resets and notices.',
        "Backblaze stores our nightly backups in the EU. They are encrypted on our server before they leave it, so Backblaze can't read them.",
        "Sentry receives a report when something breaks: technical details such as the page, the browser and the error, not your notes. It stores them in the EU.",
        'Better Stack checks that Bookclub is up. It sees no personal data.',
        'Google, only if you choose to sign in with Google.',
        "Book details come from Open Library and Google Books. Our server looks books up and passes covers through, so your device doesn't contact them and they don't learn who is searching.",
        "Where one of these companies handles data outside the EU or EEA, the transfer is covered by the European Commission's standard contractual clauses or an adequacy decision.",
      ],
    },
    {
      heading: 'How long we keep it',
      paragraphs: [
        'Until you delete your account. Deleting it removes your profile, sign-in details, readings, progress, notes (with the conversations they started), reactions, reports and blocks straight away. Clubs you own pass to another member.',
        'Backups are kept for up to 60 days, so deleted data is gone from them within 60 days.',
        'Our server logs record the time, the address requested and the result, without IP addresses or note text, and are overwritten as they fill up. Rate limits hold IP addresses briefly, in memory only.',
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: [
        'Get a copy of everything we keep about you, as a file: Account, then “Download my data”.',
        'Correct your name in Account, and edit or delete your notes at any time.',
        'Delete your account: Account, then “Delete my account”.',
        `Object to how we use your data, or ask anything else: write to ${CONTACT_EMAIL}. We answer within a month.`,
        'You can also complain to the data protection authority where you live or work.',
      ],
    },
    {
      heading: 'Cookies',
      paragraphs: [
        "One cookie keeps you signed in. It is strictly necessary, so there's nothing to accept. If you open an invite link before you have an account, the invite waits in your browser's storage for up to a day.",
      ],
    },
    {
      heading: 'Age',
      paragraphs: ['Bookclub is for people aged 13 and over, or older where the law where you live sets a higher age for online services.'],
    },
    {
      heading: 'Changes',
      paragraphs: ['If we change this policy in a way that matters to you, we will tell you in the app or by email before the change takes effect.'],
    },
  ],
};

export const terms: LegalDocument = {
  title: 'Terms of use',
  updated: '9 October 2026',
  intro: `These terms are the agreement between you and ${OPERATOR}, who runs Bookclub. By creating an account you accept them. They're short; please read them.`,
  sections: [
    {
      heading: 'The service',
      paragraphs: [
        'Bookclub lets you log your reading, read together in clubs and share notes on books. It is free. We may change, add or remove features; if a change takes away something you rely on, we will say so in advance.',
      ],
    },
    {
      heading: 'Your account',
      paragraphs: [
        'Use a real email address and keep your password to yourself. You are responsible for what happens in your account. You must be 13 or older, or older where the law requires.',
      ],
    },
    {
      heading: 'What you write',
      paragraphs: [
        'Your notes are yours. You allow us to store them and show them to the people you chose (only you, a club, or everyone reading the book) for as long as they are on Bookclub. When you delete a note it is gone, apart from backups, which are gone within 60 days.',
      ],
    },
    {
      heading: 'Be decent',
      paragraphs: [
        "Don't post anything illegal, hateful or harassing, spam or advertising, other people's personal details, or long passages of someone else's text (a short quote is fine).",
        "Put notes where they belong in the book. They stay hidden from readers who haven't reached that page, so don't place a twist early.",
        "Don't try to break, overload or scrape Bookclub, or get into other people's accounts.",
      ],
    },
    {
      heading: 'Moderation',
      paragraphs: [
        `Readers can report notes and block each other. Moderators may hide or remove notes that break these terms, and we may suspend or close accounts that keep doing so. If you think we got it wrong, write to ${CONTACT_EMAIL}.`,
      ],
    },
    {
      heading: 'Book information',
      paragraphs: [
        'Book details and covers come from Open Library and Google Books and may be wrong or incomplete. Covers belong to their publishers and are shown so you can recognise books.',
      ],
    },
    {
      heading: 'No guarantees',
      paragraphs: [
        "We run Bookclub with care, but provide it as it is, without warranties. It may sometimes be unavailable. We back it up every night, but keep your own copy of anything you can't lose: Account, then “Download my data”.",
        'As far as the law allows, we are not liable for indirect losses or lost content. Nothing in these terms limits rights you have under consumer law.',
      ],
    },
    {
      heading: 'Ending',
      paragraphs: [
        'You can delete your account at any time. If we ever close Bookclub, we will give at least 30 days’ notice and a way to download your data.',
      ],
    },
    {
      heading: 'Changes to these terms',
      paragraphs: ["We will tell you before an important change takes effect. If you don't agree, you can delete your account."],
    },
  ],
};

export const help: LegalDocument = {
  title: 'Help and contact',
  updated: '9 October 2026',
  intro: `Write to ${CONTACT_EMAIL}. We usually answer within a few days.`,
  sections: [
    {
      heading: 'Forgot your password',
      paragraphs: ['On the sign-in page, choose “Forgot your password?” and follow the link in the email. The link works for an hour.'],
    },
    {
      heading: 'No confirmation email',
      paragraphs: ['Look in your spam folder first. It comes from noreply@mail.ogun.se. Signing in again sends a new link.'],
    },
    {
      heading: "Someone's notes bother you",
      paragraphs: [
        'Open the note, choose More, then Report: it is hidden for you straight away. Or Block the person: neither of you will see the other’s notes. You can unblock people from Account.',
        'For a note that gives away the story too early, report it as “Spoils the story”.',
      ],
    },
    {
      heading: 'Your data',
      paragraphs: ['Download everything we keep about you from Account, then “Download my data”. Delete your account from Account, then “Delete my account”.'],
    },
  ],
};
