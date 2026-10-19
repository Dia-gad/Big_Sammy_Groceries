import AppRoutes from './routes/AppRoutes';
import AIAssistant from './components/assistant/AIAssistant';
import Layout from './components/layout/Layout';

function App() {
    return (
        <Layout>
            <AppRoutes />
            <AIAssistant />
        </Layout>
    );
}

export default App;