import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import './DataLoader.css'

function DataLoader() {
    // -----------------------------
    // Estados principais
    // -----------------------------
    const [users, setUsers] = useState([]) // lista de usuários
    const [tarefas, setTarefas] = useState([]) // lista de tarefas base
    const [currentDate, setCurrentDate] = useState(new Date()) // data atual exibida no calendário
    const [draggedTask, setDraggedTask] = useState(null) // tarefa sendo arrastada
    const [showUserSelect, setShowUserSelect] = useState(false) // modal de seleção de usuário
    const [selectedDay, setSelectedDay] = useState(null) // dia selecionado para atribuição de tarefa
    const [assignedTasks, setAssignedTasks] = useState({}) // tarefas atribuídas organizadas por dia
    const [showAlert, setShowAlert] = useState(false) // alerta visível?
    const [alertMessage, setAlertMessage] = useState('') // mensagem do alerta
    const [isMonthClosed, setIsMonthClosed] = useState(false) // mês fechado?

    // -----------------------------
    // Carregar dados ao iniciar ou mudar o mês
    // -----------------------------
    useEffect(() => {
        fetchUsers()
        fetchTarefas()
        fetchAssignedTasks()
        checkIfMonthClosed()
    }, [currentDate])

    // -----------------------------
    // Função auxiliar: retorna todos os dias do mês (com início no dia da semana correto)
    // -----------------------------
    const getDaysInMonth = (date) => {
        const ano = date.getFullYear()
        const mes = date.getMonth()
        const diasNoMes = new Date(ano, mes + 1, 0).getDate()
        const primeiroDiaDoMes = new Date(ano, mes, 1).getDay()

        const dias = []
        for (let i = 0; i < primeiroDiaDoMes; i++) dias.push(null) // dias vazios antes do início do mês
        for (let i = 1; i <= diasNoMes; i++) dias.push(i)
        return dias
    }

    // -----------------------------
    // Funções de carregamento de dados do Supabase
    // -----------------------------
    async function fetchUsers() {
        const { data, error } = await supabase.from('users').select('*')
        if (data) setUsers(data)
        if (error) console.error('Erro ao buscar usuários:', error)
    }

    async function fetchTarefas() {
        const { data, error } = await supabase.from('tarefas_base').select('id, nome')
        if (error) showAlertMessage('Erro ao carregar tarefas')
        else setTarefas(data)
    }

    async function fetchAssignedTasks() {
        const mes = currentDate.getMonth() + 1
        const ano = currentDate.getFullYear()
        const { data, error } = await supabase
            .from('tarefas_atribuidas')
            .select('*')
            .eq('mes', mes)
            .eq('ano', ano)

        if (error) {
            console.error(error)
            showAlertMessage('Erro ao carregar tarefas atribuídas')
            return
        }

        // Agrupar tarefas por dia
        const grouped = data.reduce((acc, task) => {
            const key = `${task.dia}-${mes - 1}-${ano}`
            if (!acc[key]) acc[key] = []
            acc[key].push(task)
            return acc
        }, {})
        setAssignedTasks(grouped)
    }

    async function checkIfMonthClosed() {
        const mes = currentDate.getMonth() + 1
        const ano = currentDate.getFullYear()
        const { data } = await supabase
            .from('competencias_fechadas')
            .select('*')
            .eq('mes', mes)
            .eq('ano', ano)
            .maybeSingle()

        setIsMonthClosed(!!data)
    }

    // -----------------------------
    // Alertas
    // -----------------------------
    const showAlertMessage = (message) => {
        setAlertMessage(message)
        setShowAlert(true)
        setTimeout(() => setShowAlert(false), 3000)
    }

    // -----------------------------
    // Verifica se o dia é útil (segunda a sexta)
    // -----------------------------
    const isWorkingDay = (day) => {
        if (!day) return false
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
        const dow = date.getDay()
        return dow !== 0 && dow !== 6
    }

    // -----------------------------
    // Funções de Drag & Drop
    // -----------------------------
    const handleDragStart = (e, tarefa) => {
        if (isMonthClosed) {
            showAlertMessage('Competência fechada — não é possível editar!')
            return
        }
        e.dataTransfer.setData('tarefa', JSON.stringify(tarefa))
        setDraggedTask(tarefa)
    }

    const handleDrop = (e, day) => {
        e.preventDefault()
        if (isMonthClosed) {
            showAlertMessage('Competência fechada — não é possível adicionar tarefas!')
            return
        }
        if (!isWorkingDay(day)) {
            showAlertMessage('Não é possível adicionar tarefas em dias não úteis!')
            return
        }
        setSelectedDay(day)
        setShowUserSelect(true)
    }

    const handleUserSelect = (user) => {
        const tarefa = draggedTask
        if (!tarefa || !selectedDay) return

        const key = `${selectedDay}-${currentDate.getMonth()}-${currentDate.getFullYear()}`
        const newTask = {
            tarefa_id: tarefa.id,
            nome_tarefa: tarefa.nome,
            dia: selectedDay,
            mes: currentDate.getMonth() + 1,
            ano: currentDate.getFullYear(),
            user_id: user.id,
            cor: user.cor
        }

        setAssignedTasks(prev => ({
            ...prev,
            [key]: [...(prev[key] || []), { ...newTask, id: `temp-${Date.now()}` }]
        }))

        setShowUserSelect(false)
        setDraggedTask(null)
        setSelectedDay(null)
    }

    const deleteTask = (day, taskIndex) => {
        if (isMonthClosed) {
            showAlertMessage('Competência fechada — não é possível excluir!')
            return
        }
        const key = `${day}-${currentDate.getMonth()}-${currentDate.getFullYear()}`
        const newTasks = { ...assignedTasks }
        newTasks[key].splice(taskIndex, 1)
        if (newTasks[key].length === 0) delete newTasks[key]
        setAssignedTasks(newTasks)
    }

    // -----------------------------
    // Salvar alterações no Supabase
    // -----------------------------
    const saveChanges = async () => {
        if (isMonthClosed) {
            showAlertMessage('Mês fechado — alterações não permitidas!')
            return
        }

        try {
            const mes = currentDate.getMonth() + 1
            const ano = currentDate.getFullYear()

            // 1️⃣ Apagar tudo do mês atual
            await supabase.from('tarefas_atribuidas').delete().match({ mes, ano })

            // 2️⃣ Inserir tudo novamente
            const allTasks = Object.values(assignedTasks).flat().map(t => ({
                tarefa_id: t.tarefa_id,
                nome_tarefa: t.nome_tarefa,
                dia: t.dia,
                mes: mes,
                ano: ano,
                user_id: t.user_id,
                cor: t.cor
            }))
            if (allTasks.length > 0)
                await supabase.from('tarefas_atribuidas').insert(allTasks)

            showAlertMessage('Alterações salvas com sucesso!')
        } catch (error) {
            console.error(error)
            showAlertMessage('Erro ao salvar alterações!')
        }
    }

    // -----------------------------
    // Fechar competência do mês
    // -----------------------------
    const fecharCompetencia = async () => {
        const mes = currentDate.getMonth() + 1
        const ano = currentDate.getFullYear()

        const { error } = await supabase
            .from('competencias_fechadas')
            .insert([{ mes, ano }])

        if (error) {
            console.error(error)
            showAlertMessage('Erro ao fechar competência!')
        } else {
            setIsMonthClosed(true)
            showAlertMessage('Competência fechada com sucesso!')
        }
    }

    // -----------------------------
    // Mudar mês
    // -----------------------------
    const changeMonth = (increment) => {
        const newDate = new Date(currentDate)
        newDate.setMonth(newDate.getMonth() + increment)
        setCurrentDate(newDate)
    }

    // -----------------------------
    // Render
    // -----------------------------
    return (
        <div className="calendar-container">
            {/* Cabeçalho com legenda de usuários e botões */}
            <div className="calendar-header">
                <div className="users-legend">
                    {users.map(u => (
                        <div key={u.id} className="user-legend-item">
                            <span className="user-color-dot" style={{ backgroundColor: u.cor }} />
                            <span className="user-name">{u.nome}</span>
                        </div>
                    ))}
                </div>
                <div className="header-buttons">
                    <button className="save-button" onClick={saveChanges}>
                        Salvar Alterações
                    </button>
                    <button
                        className="close-month-button"
                        onClick={fecharCompetencia}
                        disabled={isMonthClosed}
                    >
                        {isMonthClosed ? 'Mês Fechado' : 'Fechar Competência'}
                    </button>
                </div>
            </div>

            {/* Conteúdo principal */}
            <div className="main-content">
                {/* Sidebar com tarefas */}
                <div className="sidebar">
                    <h2 className="section-title">Tarefas</h2>
                    <div className="tasks-list">
                        {/* Ordena tarefas do menor para o maior */}
                        {tarefas
                            .slice()
                            .sort((a, b) => a.nome.length - b.nome.length)
                            .map(t => (
                                <div
                                    key={t.id}
                                    className="task-item"
                                    draggable={!isMonthClosed}
                                    onDragStart={(e) => handleDragStart(e, t)}
                                >
                                    {t.nome}
                                </div>
                            ))}
                    </div>
                </div>

                {/* Calendário */}
                <div className="calendar">
                    <div className="calendar-header-nav">
                        <button onClick={() => changeMonth(-1)}>&lt;</button>
                        <h2>
                            {currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
                        </h2>
                        <button onClick={() => changeMonth(1)}>&gt;</button>
                    </div>

                    <div className="calendar-grid">
                        {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
                            <div key={day} className="calendar-header-cell">{day}</div>
                        ))}

                        {getDaysInMonth(currentDate).map((day, index) => (
                            <div
                                key={index}
                                className={`calendar-cell ${!day ? 'empty' : ''} ${!isWorkingDay(day) ? 'non-working-day' : ''}`}
                                onDrop={(e) => handleDrop(e, day)}
                                onDragOver={(e) => e.preventDefault()}
                            >
                                <div className="day-number">{day}</div>
                                <div className="task-container">
                                    {assignedTasks[`${day}-${currentDate.getMonth()}-${currentDate.getFullYear()}`]?.map((task, i) => (
                                        <div
                                            key={i}
                                            className="assigned-task"
                                            style={{ backgroundColor: task.cor }}
                                        >
                                            <span>{task.nome_tarefa}</span>
                                            {!isMonthClosed && (
                                                <button
                                                    className="delete-task"
                                                    onClick={() => deleteTask(day, i)}
                                                >
                                                    ×
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Modal de seleção de usuário */}
            {showUserSelect && (
                <div className="user-select-modal">
                    <div className="modal-content">
                        <h3>Selecione o responsável</h3>
                        <div className="user-options">
                            {users.map(user => (
                                <button
                                    key={user.id}
                                    className="user-option"
                                    style={{ borderColor: user.cor }}
                                    onClick={() => handleUserSelect(user)}
                                >
                                    {user.nome}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Alerta */}
            {showAlert && <div className="alert">{alertMessage}</div>}
        </div>
    )
}

export default DataLoader
