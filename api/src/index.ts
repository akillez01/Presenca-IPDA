import app from './app';

const PORT = process.env.PORT || 3001;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`API iniciada na porta ${PORT}`);
  });
}

export default app;
