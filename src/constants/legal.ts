/**
 * Terms of Service and Privacy Policy text. DRAFT: written by the team to describe how the app
 * works today, not reviewed by a lawyer. Update `LEGAL_UPDATED` whenever the text changes.
 */

export const LEGAL_UPDATED = 'November 10, 2026';

/** Where people can reach the team about these policies. */
export const LEGAL_CONTACT = 'lendr.team@gmail.com';

export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { title: string; intro: string; sections: LegalSection[] };

const contactLine = LEGAL_CONTACT
  ? `Email us at ${LEGAL_CONTACT}.`
  : 'Use the Report button in the app to reach the team; a contact email is coming soon.';

export const TERMS: LegalDoc = {
  title: 'Terms of Service',
  intro:
    'Lendr is a student project that helps University of Texas students lend, rent, and sell clothes to each other. By creating an account, you agree to these terms.',
  sections: [
    {
      heading: 'Who can use Lendr',
      body: [
        'You need a valid UT email address (ending in utexas.edu) to sign up, and you must be at least 18 years old or have permission from a parent or guardian.',
        'One account per person. Keep your password private; you are responsible for what happens on your account.',
      ],
    },
    {
      heading: 'Listings',
      body: [
        'Only list clothes you own and have the right to lend or sell. Photos and descriptions must be accurate and your own.',
        'No counterfeit, stolen, unsafe, or prohibited items, and nothing offensive in photos, titles, or descriptions.',
        'By posting a listing, you let Lendr show its photos and details to other users in the app.',
      ],
    },
    {
      heading: 'Borrowing, renting, and buying',
      body: [
        'Lendr connects lenders and borrowers; it is not a party to your agreement. For now, payment is arranged directly between users, and Lendr does not process or hold money.',
        'Borrowers agree to return items on time, in the condition they received them. Lenders agree to hand over items as described, at the agreed time and place.',
        'Use the pickup and return codes in the app to confirm each handoff. Disputes about late returns, no-shows, or damage can be reported in the app, and the team may review them.',
      ],
    },
    {
      heading: 'Community rules',
      body: [
        'Be respectful. No harassment, threats, hate speech, scams, or spam in chats, reviews, or listings.',
        'Reviews must reflect a real borrow and your honest experience.',
        'Meet in public places on or near campus. Lendr does not screen users or inspect items, so use your own judgment.',
      ],
    },
    {
      heading: 'Moderation and account limits',
      body: [
        'The team may remove content, issue strikes, restrict, or ban accounts that break these terms or put others at risk.',
        'You can block anyone, and you can report users, listings, and individual messages.',
      ],
    },
    {
      heading: 'Deleting your account',
      body: [
        'You can delete your account at any time from Edit profile, as long as you have no upcoming or active borrows. See the Privacy Policy for what is removed.',
      ],
    },
    {
      heading: 'No warranty',
      body: [
        'Lendr is provided as is, while it is still being built. Features may change or stop working. To the extent the law allows, the Lendr team is not liable for lost, damaged, or misrepresented items, or for disputes between users.',
      ],
    },
    {
      heading: 'Changes',
      body: [
        'We may update these terms. If the changes are significant, we will tell you in the app. Continuing to use Lendr after an update means you accept the new terms.',
      ],
    },
    { heading: 'Contact', body: [contactLine] },
  ],
};

export const PRIVACY: LegalDoc = {
  title: 'Privacy Policy',
  intro: 'This explains what Lendr collects, why, who can see it, and how to delete it.',
  sections: [
    {
      heading: 'What we collect',
      body: [
        'Account: your name, UT email address, password (stored hashed by our sign-in provider), and optional profile photo and bio.',
        'Activity: listings and their photos, borrow, rental, and purchase requests, pickup and return codes, chats, reviews, saved items, and closet shelves.',
        'Safety: reports you file (including any photos you attach as proof), blocks, and moderation history such as strikes.',
        'Photo search: when you search by photo, the photo is sent to an image-recognition model to turn it into search words. It is not saved to your account.',
      ],
    },
    {
      heading: 'How we use it',
      body: [
        'To run the app: showing listings, matching searches, handling requests, and delivering messages.',
        'To keep the community safe: limiting sign-up to UT email addresses, reviewing reports, and enforcing the Terms of Service.',
        'We do not sell your data, and we do not show ads.',
      ],
    },
    {
      heading: 'Who can see what',
      body: [
        'Other users can see your name, profile photo, bio, badges, listings, and reviews of you. Your email address is not shown to other users.',
        'Chats are visible only to the people in them, and to the moderation team when a message is reported.',
        'Your saved items and closet shelves are private to you. Other people only see how many people saved a listing, never who.',
        'Reports are visible to you and the moderation team, not to the person reported.',
      ],
    },
    {
      heading: 'Where it is stored',
      body: [
        'Data is stored with Supabase, our database and file-hosting provider. Access is limited by database rules so each person can only reach what they are allowed to see.',
      ],
    },
    {
      heading: 'Deleting your data',
      body: [
        'Deleting your account from Edit profile permanently removes your profile, listings, photos, saved items, and shelves. Some records tied to other people, such as completed borrows and reports, may be kept so the other person’s history stays accurate and safety reviews can finish.',
      ],
    },
    {
      heading: 'Students under 18',
      body: ['Lendr is meant for university students. If you are under 18, use it only with a parent or guardian’s permission.'],
    },
    {
      heading: 'Changes',
      body: ['If we change how we use your data in a significant way, we will tell you in the app first.'],
    },
    { heading: 'Contact', body: [contactLine] },
  ],
};
