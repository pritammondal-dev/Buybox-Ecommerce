class EmailProvider {
  async send() {
    throw new Error("EmailProvider.send() must be implemented");
  }
}

module.exports = EmailProvider;