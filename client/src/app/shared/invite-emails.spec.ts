import { parseEmails } from './invite-emails';

describe('parseEmails', () => {
  it('splits on commas, spaces, semicolons and new lines, dedupes and lowercases', () => {
    expect(parseEmails('Ana@Example.com, marko@example.com;\nana@example.com  eva@x.si')).toEqual([
      'ana@example.com',
      'marko@example.com',
      'eva@x.si',
    ]);
  });

  it('ignores things that are not email addresses', () => {
    expect(parseEmails('hello, @nope, a@b, ok@mail.com')).toEqual(['ok@mail.com']);
  });
});
